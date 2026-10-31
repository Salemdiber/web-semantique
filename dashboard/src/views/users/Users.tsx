import { useCallback, useEffect, useMemo, useState } from 'react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import CardBox from 'src/components/shared/CardBox';
import { Button } from 'src/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import authAPI, {
  LIBELLES_ROLE,
  type Role,
  type Utilisateur,
} from 'src/api/auth/auth-data';
import { useAuth } from 'src/context/auth-context';

const BCrumb = [
  { to: '/', title: 'Accueil' },
  { title: 'Utilisateurs' },
];

const ROLES: Role[] = ['admin', 'formateur', 'etudiant'];

const couleurRole: Record<Role, string> = {
  admin: 'bg-lightprimary text-primary',
  formateur: 'bg-lightsecondary text-secondary',
  etudiant: 'bg-lightsuccess text-success',
};

const Utilisateurs = () => {
  const { utilisateur: moi } = useAuth();
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState<number | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      setUtilisateurs(await authAPI.utilisateurs());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const compteurs = useMemo(
    () =>
      ROLES.reduce<Record<Role, number>>(
        (acc, role) => ({
          ...acc,
          [role]: utilisateurs.filter((u) => u.role === role).length,
        }),
        { admin: 0, formateur: 0, etudiant: 0 },
      ),
    [utilisateurs],
  );

  const changerRole = async (id: number, role: Role) => {
    setEnCours(id);
    setErreur('');
    try {
      const maj = await authAPI.modifierUtilisateur(id, { role });
      setUtilisateurs((liste) => liste.map((u) => (u.id === id ? maj : u)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Modification impossible.');
    } finally {
      setEnCours(null);
    }
  };

  const basculerActif = async (utilisateur: Utilisateur) => {
    setEnCours(utilisateur.id);
    setErreur('');
    try {
      const maj = await authAPI.modifierUtilisateur(utilisateur.id, {
        actif: !utilisateur.actif,
      });
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === utilisateur.id ? maj : u)),
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Modification impossible.');
    } finally {
      setEnCours(null);
    }
  };

  const supprimer = async (utilisateur: Utilisateur) => {
    if (
      !window.confirm(
        `Supprimer définitivement le compte de ${utilisateur.nom} ?`,
      )
    ) {
      return;
    }
    setEnCours(utilisateur.id);
    setErreur('');
    try {
      await authAPI.supprimerUtilisateur(utilisateur.id);
      setUtilisateurs((liste) => liste.filter((u) => u.id !== utilisateur.id));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suppression impossible.');
    } finally {
      setEnCours(null);
    }
  };

  return (
    <>
      <BreadcrumbComp title="Module utilisateur" items={BCrumb} />

      <div className="grid grid-cols-12 gap-6">
        {ROLES.map((role) => (
          <div className="col-span-12 sm:col-span-4" key={role}>
            <CardBox className="p-5">
              <p className="text-sm text-muted-foreground mb-1">
                {LIBELLES_ROLE[role]}s
              </p>
              <h3 className="text-2xl font-semibold">{compteurs[role]}</h3>
            </CardBox>
          </div>
        ))}

        <div className="col-span-12">
          <CardBox className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="text-lg font-semibold">Comptes</h4>
                <p className="text-sm text-muted-foreground">
                  Changer un rôle, désactiver ou supprimer un compte.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={charger} disabled={chargement}>
                Recharger
              </Button>
            </div>

            {erreur && (
              <p
                role="alert"
                className="mb-4 rounded-md bg-lighterror px-3 py-2 text-sm text-error"
              >
                {erreur}
              </p>
            )}

            {chargement ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chargement des comptes…
              </p>
            ) : utilisateurs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun compte enregistré.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utilisateurs.map((u) => {
                    const estMoi = u.id === moi?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.nom}
                          {estMoi && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (vous)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          {estMoi ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${couleurRole[u.role]}`}
                            >
                              {LIBELLES_ROLE[u.role]}
                            </span>
                          ) : (
                            <Select
                              value={u.role}
                              onValueChange={(valeur) =>
                                changerRole(u.id, valeur as Role)
                              }
                              disabled={enCours === u.id}
                            >
                              <SelectTrigger size="sm" className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {LIBELLES_ROLE[role]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              u.actif
                                ? 'bg-lightsuccess text-success'
                                : 'bg-lighterror text-error'
                            }`}
                          >
                            {u.actif ? 'Actif' : 'Désactivé'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant={u.actif ? 'outlinewarning' : 'outlinesuccess'}
                              disabled={enCours === u.id || estMoi}
                              onClick={() => basculerActif(u)}
                            >
                              {u.actif ? 'Désactiver' : 'Activer'}
                            </Button>
                            <Button
                              size="sm"
                              variant="lighterror"
                              disabled={enCours === u.id || estMoi}
                              onClick={() => supprimer(u)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardBox>
        </div>
      </div>
    </>
  );
};

export default Utilisateurs;
