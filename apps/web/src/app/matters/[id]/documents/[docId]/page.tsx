'use client';

/** Retired route — the document reader was consolidated into the chat-first
 *  case workspace. Redirect any old links there. */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RetiredDocumentViewer({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const router = useRouter();
  useEffect(() => {
    params.then(p => router.replace(`/matters/${p.id}/workspace`));
  }, [params, router]);
  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin" />
    </div>
  );
}
