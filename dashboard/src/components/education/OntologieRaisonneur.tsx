/**
 * Contrôle du raisonneur OWL de Fuseki (dataset défini par fuseki/config.ttl).
 *
 * - rdf:type direct : individus VUS comme membres des classes DÉDUITS par le
 *   raisonneur (l'individu Examen_Python est vu Evaluation sans écrire
 *   le chemin rdfs:subClassOf*).
 * - nombre_avec_sous_classes : comptage via rdfs:subClassOf* (toujours juste).
 * - raisonneur_actif = True sur une ligne => les deux coïncident
 *   => l'inférence OWL fonctionne.
 */
import { useEffect, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import type { TypeInferes } from 'src/types/apps/education';

const OntologieRaisonneur = () => {
  const [lignes, setLignes] = useState<TypeInferes[]>([]);
  const [actif, setActif] = useState<boolean | null>(null);

  useEffect(() => {
    educationAPI
      .typesInferes()
      .then((rows) => {
        setLignes(rows);
        // le raisonneur est actif si sur toutes les lignes les deux comptes coïncident
        setActif(rows.length > 0 && rows.every((r) => r.raisonneur_actif));
      })
      .catch(() => setActif(null));
  }, []);

  return (
    <CardBox className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-ld">Raisonneur OWL — Fuseki</h4>
          <p className="text-xs text-ld">
            rdf:type direct (déduits par inférence OWL) vs rdfs:subClassOf*
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            actif === null
              ? 'bg-warning/10 text-warning'
              : actif
              ? 'bg-success/10 text-success'
              : 'bg-error/10 text-error'
          }`}
        >
          {actif === null
            ? 'Fuseki non joignable'
            : actif
            ? '✅ Inférence OWL active'
            : '⚠️ Inférence inactive'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-ld dark:text-ld">
              <th className="px-2 py-2">Classe OWL</th>
              <th className="px-2 py-2">rdf:type (déduit)</th>
              <th className="px-2 py-2">subClassOf*</th>
              <th className="px-2 py-2">Raisonneur</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.classe} className="border-t border-ld dark:border-ld">
                <td className="px-2 py-2 font-medium">{l.nom}</td>
                <td className="px-2 py-2">{l.nombre_rdf_type_direct}</td>
                <td className="px-2 py-2">{l.nombre_avec_sous_classes}</td>
                <td className="px-2 py-2">
                  {l.raisonneur_actif ? '✅' : '—'}
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-ld">
                  Aucune donnée — démarrer Fuseki, exécuter
                  <code className="mx-1">scripts/setup_dataset.py</code>
                  puis vérifier que fuseki/config.ttl est monté.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </CardBox>
  );
};

export default OntologieRaisonneur;
