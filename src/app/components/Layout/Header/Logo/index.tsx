import { Link } from 'react-router'
import withBasePath from '@/utils/basePath'

const Logo: React.FC = () => {
    return (
        <Link to="/">
            <img
                src={withBasePath('/images/logo/logo.svg')}
                alt="logo"
                width={160}
                height={50}
                style={{ width: "auto", height: "auto" }}
            />
        </Link>
    );
};

export default Logo;
