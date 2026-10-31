import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import GestionEvaluations from 'src/components/evaluations/GestionEvaluations';
import GestionCertifications from 'src/components/evaluations/GestionCertifications';

const BCrumb = [
  { to: '/', title: 'Accueil' },
  { title: 'Évaluations & Certifications' },
];

const Evaluations = () => {
  return (
    <>
      <BreadcrumbComp
        title="Évaluations & Certifications"
        items={BCrumb}
      />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <GestionEvaluations />
        </div>
        <div className="col-span-12">
          <GestionCertifications />
        </div>
      </div>
    </>
  );
};

export default Evaluations;
