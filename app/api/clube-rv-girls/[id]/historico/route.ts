import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const member = await prisma.clubMember.findFirst({ where: { id, deletedAt: null } });
  if (!member) return NextResponse.json({ error: "Fundadora não encontrada" }, { status: 404 });

  const history = await prisma.clubPointHistory.findMany({
    where: { clubMemberId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(history);
}
