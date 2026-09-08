# Detección de código pestilente — TaskFlow

Se identificaron cinco problemas de calidad: cuatro refactorizados y uno documentado como pendiente. La captura de la consigna no enumera los nombres de los cinco smells; los siguientes corresponden a los hallazgos de esta revisión.

## 1. Función demasiado larga (Long Method)

**Ubicación:** `updateTask` en [tasks.service.ts](server/src/modules/tasks/tasks.service.ts).

**Evidencia original:** la función reunía la búsqueda de la tarea, validación de título, descripción, prioridad, vencimiento y asignado, autorización, transición de estado, actualización, historial y serialización.

**Problema:** para entender o modificar una regla había que recorrer una función extensa con responsabilidades distintas. Eso aumentaba la posibilidad de afectar otra regla al editarla.

**Refactorización aplicada — Extract Function:** se extrajeron `validateTaskChanges`, `validateAssignee`, `assertCanChangeStatus` y `resolveNextStatus`. `updateTask` coordina esas operaciones y conserva la actualización y el registro del historial.

**Comportamiento conservado:** se validan los campos antes de escribir; los permisos se evalúan sobre la asignación original; una petición sin cambios devuelve la tarea sin actualizarla; solo se registra historial si cambia el estado.

**Estado:** refactorizado.

## 2. Condicionales excesivamente anidados

**Ubicación:** validación del asignado y autorización del cambio de estado dentro del `updateTask` original.

**Evidencia original:** la validación del asignado encadenaba condiciones para campo presente, valor nulo, identificador válido y pertenencia al proyecto, con varios bloques `else`. La autorización también anidaba comprobaciones de asignado, membresía y rol.

**Problema:** los caminos de éxito y rechazo quedaban repartidos entre niveles de indentación, dificultando comprobar todas las alternativas.

**Refactorización aplicada — Guard Clauses:** `validateAssignee` devuelve temprano para `null` y lanza los errores al detectar un identificador inválido o un usuario ajeno al proyecto. `assertCanChangeStatus` devuelve temprano si el usuario es el asignado y comprueba el permiso del resto en una única condición.

**Comportamiento conservado:** se permite quitar la asignación con `null`; los errores mantienen sus mensajes; pueden cambiar el estado el asignado, el owner o un admin.

**Estado:** refactorizado.

## 3. Código duplicado (Duplicated Code)

**Ubicación:** ramas de autorización de `updateTask` en [tasks.service.ts](server/src/modules/tasks/tasks.service.ts).

**Evidencia original:** tanto la rama del asignado como la del administrador ejecutaban:

```ts
assertTransition(task.status as Status, requested);
nextStatus = requested;
```

También se repetía el mismo error para membresía inexistente y rol sin permiso.

**Problema:** un cambio en la lógica común podía aplicarse en una rama y olvidarse en la otra, generando comportamientos diferentes según el usuario.

**Refactorización aplicada — Consolidate Duplicate Conditional Fragments:** `resolveNextStatus` comprueba el permiso y luego valida la transición una sola vez. El rechazo por falta de permiso queda centralizado en `assertCanChangeStatus`.

**Comportamiento conservado:** se comprueba el permiso antes de la transición; solicitar el estado actual sigue sin exigir permiso de cambio ni agregar historial. No se modificó la tabla de transiciones.

**Estado:** refactorizado.

## 4. Mezcla de responsabilidades

**Ubicación:** [projects.controller.ts](server/src/modules/projects/projects.controller.ts).

**Evidencia original:** las funciones del controlador leían `req`, validaban reglas de negocio, comprobaban permisos, consultaban Prisma, serializaban proyectos y construían la respuesta HTTP.

**Problema:** las reglas de proyectos estaban acopladas a Express; cambiar una regla o reutilizarla requería trabajar dentro del controlador HTTP.

**Refactorización aplicada — Extract Module:** se creó [projects.service.ts](server/src/modules/projects/projects.service.ts) para la creación, listado, edición, eliminación y gestión de miembros. El controlador interpreta identificadores de ruta, delega al servicio y construye las respuestas HTTP.

**Comportamiento conservado:** mismos filtros, orden, validaciones, consultas, mensajes, formatos de respuesta y códigos HTTP. Se mantiene la distinción entre 403 para miembros sin permiso y 404 para usuarios externos en edición y eliminación. Se trasladó la lógica existente sin corregir reglas funcionales como parte de esta extracción.

**Estado:** refactorizado.

## 5. Errores silenciados (Swallowed Exceptions)

**Ubicación:** `serialize` en [comments.service.ts](server/src/modules/comments/comments.service.ts).

**Evidencia:**

```ts
} catch (e) {
  return null;
}
```

**Problema:** cualquier excepción durante la serialización se convierte en `null`. Por ejemplo, una fecha inválida podría producir un elemento nulo en el listado sin revelar el fallo al manejador de errores. Además, el parámetro `c: any` impide verificar estáticamente su estructura.

**Mejora propuesta:** tipar el comentario y permitir que los errores inesperados lleguen al manejador de errores existente, definiendo y verificando el resultado esperado para esos casos.

**Estado:** documentado, pendiente de corrección. Quitar el `catch` cambiaría la respuesta observable ante errores: actualmente devuelve `null`; al propagar la excepción, la API respondería con un error 500. Se conserva el código para mantener el alcance de refactorización sin cambios de comportamiento. La consigna permite documentar hallazgos aunque no se refactoricen todos.

## Verificación

- **Punto de partida:** verificamos que la suite existente pasaba antes de los cambios.
- **Compilación:** `npm run build` finalizó correctamente después de las refactorizaciones.
- **Suite existente:** ejecutamos `npm test` después de las refactorizaciones y confirmamos que todos los tests pasan.
- **Integridad:** no se modificaron ni agregaron tests en el resultado final. No se cambiaron dependencias ni configuración de pruebas.
