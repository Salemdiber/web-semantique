// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import Loadable from '../layouts/full/shared/loadable/Loadable';
import RequireAuth from './RequireAuth';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// Authentification
const Login2 = Loadable(lazy(() => import('../views/authentication/auth2/Login')));
const Register2 = Loadable(lazy(() => import('../views/authentication/auth2/Register')));
const Error = Loadable(lazy(() => import('../views/authentication/Error')));

// Modules du projet
const Accueil = Loadable(lazy(() => import('../views/dashboards/Modern')));
const Education = Loadable(lazy(() => import('../views/education/Education')));
const Utilisateurs = Loadable(lazy(() => import('../views/users/Users')));
const Evaluations = Loadable(lazy(() => import('../views/evaluations/Evaluations')));

const Router = [
  {
    path: '/',
    element: (
      <RequireAuth>
        <FullLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <Accueil /> },
      { path: '/education', element: <Education /> },
      { path: '/evaluations', element: <Evaluations /> },
      {
        path: '/utilisateurs',
        element: (
          <RequireAuth roles={['admin']}>
            <Utilisateurs />
          </RequireAuth>
        ),
      },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/auth/auth2/login', element: <Login2 /> },
      { path: '/auth/auth2/register', element: <Register2 /> },
      { path: '/auth/404', element: <Error /> },
      { path: '404', element: <Error /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
];

const router = createBrowserRouter(Router);

export default router;
