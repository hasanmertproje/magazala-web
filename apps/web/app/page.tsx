import { redirect } from 'next/navigation';
import { getAuthContext } from '../lib/auth';
import { db } from '../lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const auth = await getAuthContext();

  if (auth) {
    redirect('/create/design-studio');
  }

  const userCount = await db.user.count();
  if (userCount === 0) {
    redirect('/setup');
  }

  redirect('/login');
}
