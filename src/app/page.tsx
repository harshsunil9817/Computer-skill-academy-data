
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
  return null; // Or a loading spinner if redirect takes time, though usually it's fast
}
