import Signup from '@/app/components/Auth/SignUp';
import Breadcrumb from '@/app/components/Common/Breadcrumb';

const SignupPage = () => {
    return (
        <>
            <Breadcrumb pageName='Sign Up Page' />

            <Signup />
        </>
    );
};

export default SignupPage;
