import Hero from '@/app/components/Home/Hero';
import Companies from '@/app/components/Home/Companies';
import NamesList from '@/app/components/Home/Courses';
import CoursesOntology from '@/app/components/Home/CoursesOntology';
import Mentor from '@/app/components/Home/Mentor';
import Testimonial from '@/app/components/Home/Testimonial';
import Newsletter from '@/app/components/Home/Newsletter';
import ContactForm from '@/app/components/Contact/Form';

const Home = () => {
    return (
        <main>
            <Hero />
            <Companies />
            <NamesList />
            <CoursesOntology />
            <Mentor />
            <Testimonial />
            <ContactForm />
            <Newsletter />
        </main>
    );
};

export default Home;
