import { Route, Routes } from 'react-router';
import Aoscompo from '@/utils/aos';
import Header from '@/app/components/Layout/Header';
import Footer from '@/app/components/Layout/Footer';
import ScrollToTop from '@/app/components/ScrollToTop';
import ScrollToHash from '@/app/components/ScrollToHash';
import Home from '@/app/pages/Home';
import NotFoundPage from '@/app/pages/NotFound';

/**
 * Layout applicatif + table de routage (React Router).
 * Seule la page d'accueil et la page 404 sont exposées.
 */
export default function App() {
    return (
        <Aoscompo>
            <Header />
            <ScrollToHash />
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='*' element={<NotFoundPage />} />
            </Routes>
            <Footer />
            <ScrollToTop />
        </Aoscompo>
    );
}
