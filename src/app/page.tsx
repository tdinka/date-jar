import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import Jar, { type IdeaView, type PlanView } from "@/components/Jar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requireSession();
  const [ideas, plan] = await Promise.all([
    prisma.idea.findMany({
      where: { status: "jar" },
      orderBy: { createdAt: "desc" },
      include: { addedBy: { select: { id: true, email: true, name: true } }, dates: { orderBy: { date: "asc" }, select: { date: true } } },
    }),
    prisma.plan.findUnique({ where: { id: "next" } }),
  ]);
  const history = await prisma.dateLog.findMany({
    orderBy: { date: "desc" },
    take: 30,
    include: { idea: { select: { title: true } } },
  });

  const ideaViews: IdeaView[] = ideas.map((i) => ({
    id: i.id,
    title: i.title,
    place: i.place,
    notes: i.notes,
    cost: i.cost,
    setting: i.setting,
    needsBooking: i.needsBooking,
    source: i.source,
    addedBy: i.addedBy && i.addedBy.id !== session.userId ? i.addedBy.name || i.addedBy.email.split("@")[0] : i.addedBy ? "you" : null,
    dates: i.dates.map((d) => d.date.toISOString().slice(0, 10)),
  }));
  const planView: PlanView | null = plan
    ? { title: plan.title, place: plan.place, when: plan.when ? plan.when.toISOString() : null, booking: plan.booking }
    : null;

  return (
    <Jar
      ideas={ideaViews}
      plan={planView}
      history={history.map((h) => ({ id: h.id, title: h.idea.title, date: h.date.toISOString().slice(0, 10) }))}
      email={session.email}
    />
  );
}
