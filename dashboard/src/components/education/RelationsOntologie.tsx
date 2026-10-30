/** Récapitulatif des ontologies liées aux cours (Pré → Cours → Compétences). */
import { useEffect, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import type { RelationCoursCompetence } from 'src/types/apps/education';

const RelationsOntologie = () => {
  const [relations, setRelations] = useState<RelationCoursCompetence[]>(
    []
  );

  useEffect(() => {
    educationAPI
      .relations()
      .then(setRelations)
      .catch(() => setRelations([]));
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {relations.map((rel, i) => (
        <CardBox key={`${rel.coursNom}-${i}`} className="p-5">
          <h4 className="text-lg font-semibold text-ld dark:text-ld">
            {rel.coursNom}
          </h4>
          <p className="text-sm text-ld mt-1">Durée : {rel.duree}</p>
          <div className="mt-3 text-sm">
            <p>
              <strong>Prérequis :</strong> {rel.prerequisNom ?? 'aucun'}
              {rel.prerequisCompetence && ` (→ ${rel.prerequisCompetence})`}
            </p>
            <p>
              <strong>Compétence développe :</strong>{' '}
              {rel.competenceNom ?? 'aucune'}
              {rel.competenceNiveau && ` (niveau ${rel.competenceNiveau})`}
            </p>
          </div>
        </CardBox>
      ))}
    </div>
  );
};

export default RelationsOntologie;
