import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import GestionFormations from 'src/components/formations/GestionFormations';

const BCrumb = [
  { to: '/', title: 'Accueil' },
  { title: 'Formations' },
];

const Formations = () => (
  <>
    <BreadcrumbComp title="Gestion des formations" items={BCrumb} />
    <GestionFormations />
  </>
);

export default Formations;
