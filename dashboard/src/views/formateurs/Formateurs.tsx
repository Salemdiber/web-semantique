import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import GestionFormateurs from 'src/components/formateurs/GestionFormateurs';

const Formateurs = () => (
  <>
    <BreadcrumbComp title="Gestion des formateurs" items={[{ to: '/', title: 'Accueil' }, { title: 'Formateurs' }]} />
    <GestionFormateurs />
  </>
);

export default Formateurs;
