import { prisma } from "@/lib/prisma";

export default async function Home() {
  const users = await prisma.user.findMany();

  return (
    <div style={{ padding: 20 }}>
      <h1>Cybrosoft Cloud Console</h1>
      <p>Total Users: {users.length}</p>
    </div>
  );
}