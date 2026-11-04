import Hero from '@/app/components/Home/Hero';
import CoursesOntology from '@/app/components/Home/CoursesOntology';
import Parcours from '@/app/components/Home/Parcours';
import FormationsOntology from '@/app/components/Home/FormationsOntology';
import MesFormations from '@/app/components/Home/MesFormations';
import Mentor from '@/app/components/Home/Mentor';

const Home = () => {
    return (
        <main>
            <Hero />
            <CoursesOntology />
            <Parcours />
            <FormationsOntology />
            <MesFormations />
            <Mentor />
        </main>
    );
};

export default Home;
