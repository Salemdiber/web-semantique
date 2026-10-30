import { Route, Routes } from 'react-router';
import Aoscompo from '@/utils/aos';
import Header from '@/app/components/Layout/Header';
import Footer from '@/app/components/Layout/Footer';
import ScrollToTop from '@/app/components/ScrollToTop';
import Home from '@/app/pages/Home';
import Documentation from '@/app/pages/Documentation';
import Signin from '@/app/pages/Signin';
import Signup from '@/app/pages/Signup';
import NotFoundPage from '@/app/pages/NotFound';

/**
 * Layout applicatif + table de routage (React Router).
 * Remplace l'App Router de Next.js (src/app/layout.tsx + src/app/page.tsx).
 */
export default function App() {
    return (
        <Aoscompo>
            <Header />
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/documentation' element={<Documentation />} />
                <Route path='/signin' element={<Signin />} />
                <Route path='/signup' element={<Signup />} />
                <Route path='*' element={<NotFoundPage />} />
            </Routes>
            <Footer />
            <ScrollToTop />
        </Aoscompo>
    );
}
