import CatalogueOntologie from 'src/components/education/CatalogueOntologie';
import OntologieStatistiques from 'src/components/education/OntologieStatistiques';
import OntologieRaisonneur from 'src/components/education/OntologieRaisonneur';
import RelationsOntologie from 'src/components/education/RelationsOntologie';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: '/',
    title: 'Accueil',
  },
  {
    title: 'Ontologie Éducation',
  },
];

const EducationAppContent = () => {
  return (
    <>
      <BreadcrumbComp title="Ontologie Éducation & Formation" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <OntologieStatistiques />
        </div>
        <div className="col-span-12">
          <OntologieRaisonneur />
        </div>
        <div className="col-span-12">
          <CatalogueOntologie />
        </div>
        <div className="col-span-12">
          <h4 className="text-xl font-semibold mb-4 mt-2">
            Relations de l'ontologie (Prérequis → Cours → Compétences)
          </h4>
          <RelationsOntologie />
        </div>
      </div>
    </>
  );
};

export default EducationAppContent;
