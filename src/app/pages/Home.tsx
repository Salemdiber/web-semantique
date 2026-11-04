import Hero from '@/app/components/Home/Hero';
import CoursesOntology from '@/app/components/Home/CoursesOntology';
import Parcours from '@/app/components/Home/Parcours';
import Mentor from '@/app/components/Home/Mentor';

const Home = () => {
    return (
        <main>
            <Hero />
            <CoursesOntology />
            <Parcours />
            <Mentor />
        </main>
    );
};

export default Home;
