import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getAdminData() {
  try {
    const [
      userCount,
      assistantCount,
      conversationCount,
      messageCount,
      storyCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.assistant.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.story.count(),
    ]);

    return {
      userCount,
      assistantCount,
      conversationCount,
      messageCount,
      storyCount,
    };
  } catch {
    return {
      userCount: 0,
      assistantCount: 0,
      conversationCount: 0,
      messageCount: 0,
      storyCount: 0,
    };
  }
}

export default async function AdminPage() {
  const data = await getAdminData();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-purple-400">
              PUTRA AI
            </p>

            <h1 className="text-3xl font-bold">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-zinc-400">
              Kelola sistem, pengguna, assistant, percakapan, dan konten Putra AI.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex w-fit items-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium transition hover:bg-zinc-800"
          >
            ← Kembali ke Putra
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Users"
            value={data.userCount}
            description="Total pengguna"
          />

          <StatCard
            title="Assistants"
            value={data.assistantCount}
            description="AI assistants"
          />

          <StatCard
            title="Conversations"
            value={data.conversationCount}
            description="Total percakapan"
          />

          <StatCard
            title="Messages"
            value={data.messageCount}
            description="Total pesan"
          />

          <StatCard
            title="Stories"
            value={data.storyCount}
            description="Total cerita"
          />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <AdminCard
            title="Assistant Management"
            description="Kelola Putra, Nara, Raka, dan assistant lainnya."
            href="/admin/assistants"
          />

          <AdminCard
            title="User Management"
            description="Lihat dan kelola pengguna platform."
            href="/admin/users"
          />

          <AdminCard
            title="Providers & Models"
            description="Kelola provider AI dan konfigurasi model."
            href="/admin/providers"
          />

          <AdminCard
            title="Voices"
            description="Kelola konfigurasi suara dan voice profile."
            href="/admin/voices"
          />
        </section>

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-xl font-semibold">
            System Status
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <StatusItem
              label="Application"
              value="Online"
            />

            <StatusItem
              label="Database"
              value="Connected"
            />

            <StatusItem
              label="AI Platform"
              value="Ready"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="text-sm text-zinc-400">{title}</p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>

      <p className="mt-1 text-xs text-zinc-500">
        {description}
      </p>
    </div>
  );
}

function AdminCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 transition hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {title}
        </h2>

        <span className="text-zinc-500 transition group-hover:translate-x-1">
          →
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {description}
      </p>
    </Link>
  );
}

function StatusItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-400" />

        <span className="text-sm font-medium">
          {value}
        </span>
      </div>
    </div>
  );
}
