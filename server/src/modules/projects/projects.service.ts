import { db } from '../../lib/db';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http';
import { toPublicId } from '../../lib/ids';
import { assertOptionalString } from '../../lib/validation';

const EMAIL_CHECK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serialize(p: {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  archived: boolean;
  createdAt: Date;
}) {
  return {
    id: toPublicId('proj', p.id),
    name: p.name,
    description: p.description,
    ownerId: toPublicId('user', p.ownerId),
    archived: p.archived,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function create(userId: number, body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length > 100) {
    throw badRequest('name must be between 3 and 100 characters');
  }
  const description = assertOptionalString(body.description, 'description', 500);

  const duplicate = await db.project.findFirst({ where: { ownerId: userId, name } });
  if (duplicate) throw conflict('You already have a project with that name');

  const project = await db.project.create({
    data: { name, description: description ?? null, ownerId: userId },
  });
  await db.projectMember.create({
    data: { projectId: project.id, userId, role: 'OWNER' },
  });

  return serialize(project);
}

export async function list(userId: number) {
  const projects = await db.project.findMany({
    where: {
      OR: [
        { ownerId: userId, archived: false },
        { members: { some: { userId } }, ownerId: { not: userId } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  return projects.map(serialize);
}

export async function update(id: number, userId: number, body: Record<string, unknown>) {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw notFound('Project not found');
  if (project.ownerId !== userId) {
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (membership) throw forbidden('Only the project owner can edit it');
    throw notFound('Project not found');
  }

  const data: { name?: string; description?: string | null } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 3 || name.length > 100) {
      throw badRequest('name must be between 3 and 100 characters');
    }
    const duplicate = await db.project.findFirst({
      where: { ownerId: userId, name, id: { not: id } },
    });
    if (duplicate) throw conflict('You already have a project with that name');
    data.name = name;
  }
  if (body.description !== undefined) {
    data.description = assertOptionalString(body.description, 'description', 500) ?? null;
  }

  return serialize(await db.project.update({ where: { id }, data }));
}

export async function remove(id: number, userId: number): Promise<void> {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw notFound('Project not found');
  if (project.ownerId !== userId) {
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (membership) throw forbidden('Only the project owner can delete it');
    throw notFound('Project not found');
  }

  await db.project.delete({ where: { id } });
}

export async function addMember(id: number, userId: number, body: Record<string, unknown>) {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw notFound('Project not found');
  if (project.ownerId !== userId) throw forbidden('Only the project owner can manage members');

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_CHECK.test(email)) throw badRequest('email must be a valid address');

  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw notFound('No user found with that email');

  const existing = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: user.id } },
  });
  if (existing) throw conflict('User is already a member of this project');

  await db.projectMember.create({ data: { projectId: id, userId: user.id, role: 'MEMBER' } });
  return {
    projectId: toPublicId('proj', id),
    userId: toPublicId('user', user.id),
    email: user.email,
    role: 'MEMBER',
  };
}

export async function removeMember(id: number, memberId: number, actingUserId: number): Promise<void> {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw notFound('Project not found');
  if (project.ownerId !== actingUserId) {
    throw forbidden('Only the project owner can manage members');
  }
  if (memberId === project.ownerId) {
    throw badRequest('The project owner cannot be removed from the project');
  }

  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: memberId } },
  });
  if (!membership) throw notFound('User is not a member of this project');

  await db.projectMember.delete({ where: { id: membership.id } });
}
