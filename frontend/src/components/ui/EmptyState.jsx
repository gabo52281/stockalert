import { Inbox } from 'lucide-react';

export default function EmptyState({ message = 'No hay información disponible', icon: Icon = Inbox, detail }) {
  return (
    <div className="empty-state">
      <Icon size={34} strokeWidth={1.5} />
      <p>{message}</p>
      {detail && <small>{detail}</small>}
    </div>
  );
}
