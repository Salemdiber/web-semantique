import { Route, Routes } from 'react-router';
import Aoscompo from '@/utils/aos';
import Header from '@/app/components/Layout/Header';
import Footer from '@/app/components/Layout/Footer';
import ScrollToTop from '@/app/components/ScrollToTop';
import ScrollToHash from '@/app/components/ScrollToHash';
import Home from '@/app/pages/Home';
import ParcoursPage from '@/app/pages/ParcoursPage';
import NotFoundPage from '@/app/pages/NotFound';

/**
 * Layout applicatif + table de routage (React Router).
 * Expose la page d'accueil, le catalogue dédié des parcours et la page 404.
 */
export default function App() {
    return (
        <Aoscompo>
            <Header />
            <ScrollToHash />
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/parcours' element={<ParcoursPage />} />
                <Route path='/parcours/:id' element={<ParcoursPage />} />
                <Route path='*' element={<NotFoundPage />} />
            </Routes>
            <Footer />
            <ScrollToTop />
        </Aoscompo>
    );
}
