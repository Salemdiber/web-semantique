import GestionCompetences from 'src/components/education/GestionCompetences';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  { to: '/', title: 'Accueil' },
  { title: 'Compétences & prérequis' },
];

const Competences = () => (
  <>
    <BreadcrumbComp title="Gestion des compétences et prérequis" items={BCrumb} />
    <GestionCompetences />
  </>
);

export default Competences;
