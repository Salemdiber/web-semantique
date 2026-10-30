import Signin from '@/app/components/Auth/SignIn';
import Breadcrumb from '@/app/components/Common/Breadcrumb';

const SigninPage = () => {
    return (
        <>
            <Breadcrumb pageName='Sign In Page' />

            <Signin />
        </>
    );
};

export default SigninPage;
