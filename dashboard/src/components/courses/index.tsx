import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import GestionCours from 'src/components/courses/GestionCours';

const BCrumb = [
  {
    to: '/',
    title: 'Accueil',
  },
  {
    title: 'Gestion des cours',
  },
];

const CoursesAppContent = () => {
  return (
    <>
      <BreadcrumbComp title="Gestion des cours" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <GestionCours />
        </div>
      </div>
    </>
  );
};

export default CoursesAppContent;
