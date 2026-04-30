import { isConfigured } from "@/lib/supabase/server";
import { createChantier } from "@/app/chantiers/actions";
import ConfigGate from "@/components/ConfigGate";

export default function NewChantierPage() {
  if (!isConfigured()) return <ConfigGate />;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Nouveau chantier</h1>
      <form action={createChantier} className="card space-y-3">
        <div>
          <label className="label">Nom du chantier *</label>
          <input
            name="name"
            required
            className="input"
            placeholder="ex: Terrasse Dupont"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Client</label>
            <input name="client" className="input" placeholder="M. Dupont" />
          </div>
          <div>
            <label className="label">Démarrage</label>
            <input
              name="started_on"
              type="date"
              defaultValue={today}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label">Adresse</label>
          <input name="address" className="input" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={3} className="input" />
        </div>
        <div className="flex justify-end gap-2">
          <a href="/chantiers" className="btn-secondary">
            Annuler
          </a>
          <button className="btn-primary">Créer</button>
        </div>
      </form>
    </div>
  );
}
