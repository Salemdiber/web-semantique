'use client';

import { useNavigate } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'src/components/ui/dropdown-menu';
import { Button } from 'src/components/ui/button';
import { useAuth } from 'src/context/auth-context';
import { LIBELLES_ROLE } from 'src/api/auth/auth-data';

const Profile = () => {
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();

  const initiales = (utilisateur?.nom ?? '?')
    .split(/\s+/)
    .map((mot) => mot[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const seDeconnecter = () => {
    deconnexion();
    navigate('/auth/auth2/login', { replace: true });
  };

  return (
    <div className="relative group/menu ps-1 sm:ps-15 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className="hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
            <span
              title={utilisateur?.nom}
              className="h-[35px] w-[35px] rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center"
            >
              {initiales}
            </span>
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-screen sm:w-[240px] pb-4 pt-4 rounded-sm"
        >
          <div className="px-4 pb-2">
            <p className="mb-0 text-sm font-semibold text-foreground truncate">
              {utilisateur?.nom ?? 'Utilisateur'}
            </p>
            <p className="mb-0 text-xs text-muted-foreground truncate">
              {utilisateur?.email}
            </p>
            {utilisateur && (
              <span className="mt-2 inline-block rounded-full bg-lightprimary px-2 py-0.5 text-[11px] font-medium text-primary">
                {LIBELLES_ROLE[utilisateur.role]}
              </span>
            )}
          </div>

          <DropdownMenuSeparator className="my-2" />

          <div className="px-4">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-md"
              onClick={seDeconnecter}
            >
              Se déconnecter
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default Profile;
