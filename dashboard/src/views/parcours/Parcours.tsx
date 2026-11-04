import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { useAuth } from 'src/context/auth-context';
import GestionParcoursAdmin from 'src/components/parcours/GestionParcoursAdmin';
import PortailParcoursEtudiant from 'src/components/parcours/PortailParcoursEtudiant';

const ParcoursView = () => {
  const { utilisateur } = useAuth();
  const estEtudiant = utilisateur?.role === 'etudiant';

  const titre = estEtudiant
    ? "Mes parcours d'apprentissage"
    : "Gestion des parcours d'apprentissage";

  const BCrumb = [{ to: '/', title: 'Accueil' }, { title: titre }];

  return (
    <>
      <BreadcrumbComp title={titre} items={BCrumb} />
      {estEtudiant ? <PortailParcoursEtudiant /> : <GestionParcoursAdmin />}
    </>
  );
};

export default ParcoursView;

