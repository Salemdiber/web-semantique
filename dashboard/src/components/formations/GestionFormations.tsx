import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import educationAPI, {
  type FormationEntree,
} from 'src/api/education/education-data';
import type {
  CertificationType,
  Cours,
  Formation,
  Programme,
} from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';

const VIDE = '__vide__';

const GestionFormations = () => {
  const { utilisateur } = useAuth();
  const peutEditer =
    utilisateur?.role === 'admin' || utilisateur?.role === 'formateur';
  const [formations, setFormations] = useState<Formation[]>([]);
  const [cours, setCours] = useState<Cours[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [certifications, setCertifications] = useState<CertificationType[]>([]);
  const [selection, setSelection] = useState<Formation | null>(null);
  const [edition, setEdition] = useState<Formation | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState<FormationEntree>({
    nom: '',
    duree: '',
    description: '',
    cours: [],
    programme: null,
    certification: null,
  });
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [recherche, setRecherche] = useState('');
  const [filtreProgramme, setFiltreProgramme] = useState('');
  const [filtreCertification, setFiltreCertification] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const [liste, listeCours, listeProgrammes, listeCertifications] =
        await Promise.all([
          utilisateur?.role === 'formateur'
            ? educationAPI.mesFormations()
            : educationAPI.formations(),
          educationAPI.cours(),
          educationAPI.programmes(),
          educationAPI.certifications(),
        ]);
      setFormations(liste);
      setCours(listeCours);
      setProgrammes(listeProgrammes);
      setCertifications(listeCertifications);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvrirCreation = () => {
    setSelection(null);
    setEdition(null);
    setFormulaireOuvert(true);
    setFormulaire({
      nom: '',
      duree: '',
      description: '',
      cours: [],
      programme: null,
      certification: null,
    });
    setMessage('');
  };

  const ouvrirEdition = (formation: Formation) => {
    setSelection(formation);
    setEdition(formation);
    setFormulaireOuvert(true);
    setFormulaire({
      nom: formation.nom,
      duree: formation.duree === 'Durée non précisée' ? '' : formation.duree,
      description: formation.description ?? '',
      cours: formation.cours
        .map((nom) => cours.find((item) => item.nom === nom)?.id)
        .filter((id): id is string => Boolean(id)),
      programme:
        programmes.find((item) => item.nom === formation.programme)?.id ?? null,
      certification:
        certifications.find((item) => item.nom === formation.certification)?.id ??
        null,
    });
    setMessage('');
  };

  const changerChamp = (champ: keyof FormationEntree, valeur: string) => {
    setFormulaire((precedent) => ({ ...precedent, [champ]: valeur }));
  };

  const basculerCours = (id: string) => {
    setFormulaire((precedent) => ({
      ...precedent,
      cours: precedent.cours?.includes(id)
        ? precedent.cours.filter((coursId) => coursId !== id)
        : [...(precedent.cours ?? []), id],
    }));
  };

  const soumettre = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnCours(true);
    setErreur('');
    setMessage('');
    try {
      const donnees = {
        ...formulaire,
        description: formulaire.description?.trim() || null,
        programme: formulaire.programme || null,
        certification: formulaire.certification || null,
      };
      const resultat = edition
        ? await educationAPI.modifierFormation(edition.id, donnees)
        : await educationAPI.creerFormation(donnees);
      setFormations((precedentes) =>
        edition
          ? precedentes.map((item) => (item.id === resultat.id ? resultat : item))
          : [...precedentes, resultat],
      );
      setSelection(resultat);
      setEdition(null);
      setFormulaireOuvert(false);
      setMessage(edition ? 'Formation modifiée.' : 'Formation créée.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (formation: Formation) => {
    if (!window.confirm(`Supprimer « ${formation.nom} » ?`)) return;
    setEnCours(true);
    setErreur('');
    try {
      await educationAPI.supprimerFormation(formation.id);
      setFormations((precedentes) =>
        precedentes.filter((item) => item.id !== formation.id),
      );
      if (selection?.id === formation.id) setSelection(null);
      if (edition?.id === formation.id) {
        setEdition(null);
        setFormulaireOuvert(false);
      }
      setMessage('Formation supprimée.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suppression impossible.');
    } finally {
      setEnCours(false);
    }
  };

  const formationsTriees = useMemo(
    () => {
      const terme = recherche.trim().toLocaleLowerCase();
      return [...formations]
        .filter((formation) => {
          const correspondRecherche =
            !terme ||
            [
              formation.nom,
              formation.duree,
              formation.description ?? '',
              formation.programme ?? '',
              formation.certification ?? '',
              ...formation.cours,
            ].some((valeur) =>
              valeur.toLocaleLowerCase().includes(terme),
            );
          const correspondProgramme =
            !filtreProgramme || formation.programme === filtreProgramme;
          const correspondCertification =
            !filtreCertification ||
            formation.certification === filtreCertification;
          return (
            correspondRecherche &&
            correspondProgramme &&
            correspondCertification
          );
        })
        .sort((a, b) => a.nom.localeCompare(b.nom));
    },
    [formations, recherche, filtreProgramme, filtreCertification],
  );

  return (
    <div className="grid grid-cols-12 gap-6">
      <CardBox className="col-span-12 p-0 overflow-hidden xl:col-span-7">
        <div className="flex items-center justify-between border-b border-ld px-4 py-4">
          <div>
            <h4 className="text-xl font-semibold">Formations</h4>
            <p className="text-sm text-ld">{formations.length} formation(s)</p>
          </div>
          {peutEditer && (
            <button
              type="button"
              onClick={ouvrirCreation}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Ajouter
            </button>
          )}
        </div>
        {erreur && (
          <div className="m-4 rounded-md bg-error/10 px-4 py-3 text-sm text-error">
            {erreur}
          </div>
        )}
        {message && (
          <div className="m-4 rounded-md bg-success/10 px-4 py-3 text-sm text-success">
            {message}
          </div>
        )}
        <div className="grid gap-3 border-b border-ld p-4 md:grid-cols-3">
          <input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher une formation..."
            aria-label="Rechercher une formation"
            className="w-full rounded-md border border-ld px-3 py-2 text-sm"
          />
          <select
            value={filtreProgramme}
            onChange={(event) => setFiltreProgramme(event.target.value)}
            aria-label="Filtrer par programme"
            className="w-full rounded-md border border-ld px-3 py-2 text-sm"
          >
            <option value="">Tous les programmes</option>
            {programmes.map((programme) => (
              <option key={programme.id} value={programme.nom}>
                {programme.nom}
              </option>
            ))}
          </select>
          <select
            value={filtreCertification}
            onChange={(event) => setFiltreCertification(event.target.value)}
            aria-label="Filtrer par certification"
            className="w-full rounded-md border border-ld px-3 py-2 text-sm"
          >
            <option value="">Toutes les certifications</option>
            {certifications.map((certification) => (
              <option key={certification.id} value={certification.nom}>
                {certification.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left">
            <thead className="bg-lightprimary">
              <tr className="text-xs uppercase tracking-wide text-primary">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Cours</th>
                {peutEditer && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {chargement ? (
                <tr>
                  <td colSpan={peutEditer ? 4 : 3} className="px-4 py-8 text-center">
                    Chargement…
                  </td>
                </tr>
              ) : formationsTriees.length === 0 ? (
                <tr>
                  <td colSpan={peutEditer ? 4 : 3} className="px-4 py-8 text-center">
                    Aucune formation ne correspond aux critères.
                  </td>
                </tr>
              ) : (
                formationsTriees.map((formation) => (
                  <tr
                    key={formation.id}
                    onClick={() => setSelection(formation)}
                    className={`cursor-pointer border-b border-ld last:border-0 hover:bg-lightprimary ${
                      selection?.id === formation.id ? 'bg-lightprimary' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{formation.nom}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formation.programme || 'Programme non précisé'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{formation.duree}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-lightprimary px-2.5 py-1 text-xs font-semibold text-primary">
                        {formation.cours.length} cours
                      </span>
                    </td>
                    {peutEditer && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="mr-3 text-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            ouvrirEdition(formation);
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="text-error"
                          onClick={(event) => {
                            event.stopPropagation();
                            supprimer(formation);
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardBox>

      {(formulaireOuvert || selection || !peutEditer) && (
        <CardBox className="col-span-12 p-6 xl:col-span-5">
        {formulaireOuvert && (edition || peutEditer) ? (
          <form onSubmit={soumettre} className="space-y-5">
            <div className="rounded-xl bg-gradient-to-r from-primary to-secondary p-5 text-white">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">
                Gestion des formations
              </p>
              <h4 className="text-2xl font-semibold">
                {edition ? 'Modifier la formation' : 'Ajouter une formation'}
              </h4>
              <p className="mt-1 text-sm text-white/80">
                Renseignez les informations principales et le contenu pédagogique.
              </p>
            </div>

            <div className="rounded-lg border border-ld p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Informations générales
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">
                    Nom de la formation <span className="text-error">*</span>
                  </span>
                  <input
                    required
                    minLength={2}
                    value={formulaire.nom}
                    onChange={(event) => changerChamp('nom', event.target.value)}
                    placeholder="Ex. Développement web moderne"
                    className="w-full rounded-md border border-ld bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-primary"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium">
                    Durée <span className="text-error">*</span>
                  </span>
                  <input
                    required
                    value={formulaire.duree}
                    onChange={(event) => changerChamp('duree', event.target.value)}
                    placeholder="Ex. 3 mois"
                    className="w-full rounded-md border border-ld bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-primary"
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium">Programme</span>
                  <select
                    value={formulaire.programme ?? VIDE}
                    onChange={(event) =>
                      changerChamp(
                        'programme',
                        event.target.value === VIDE ? '' : event.target.value,
                      )
                    }
                    className="w-full rounded-md border border-ld bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value={VIDE}>Aucun programme</option>
                    {programmes.map((programme) => (
                      <option key={programme.id} value={programme.id}>
                        {programme.nom}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Description</span>
                  <textarea
                    value={formulaire.description ?? ''}
                    onChange={(event) => changerChamp('description', event.target.value)}
                    placeholder="Décrivez les objectifs et le contenu de la formation..."
                    rows={4}
                    className="w-full resize-y rounded-md border border-ld bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-primary"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">Certification</span>
                  <select
                    value={formulaire.certification ?? VIDE}
                    onChange={(event) =>
                      changerChamp(
                        'certification',
                        event.target.value === VIDE ? '' : event.target.value,
                      )
                    }
                    className="w-full rounded-md border border-ld bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value={VIDE}>Aucune certification</option>
                    {certifications.map((certification) => (
                      <option key={certification.id} value={certification.id}>
                        {certification.nom}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-ld p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contenu pédagogique
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sélectionnez les cours inclus dans cette formation.
                  </p>
                </div>
                <span className="rounded-full bg-lightprimary px-3 py-1 text-xs font-semibold text-primary">
                  {formulaire.cours?.length ?? 0} sélectionné(s)
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {cours.map((item) => {
                  const selectionne = formulaire.cours?.includes(item.id) ?? false;
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                        selectionne
                          ? 'border-primary bg-lightprimary text-primary'
                          : 'border-ld hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectionne}
                        onChange={() => basculerCours(item.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="font-medium">{item.nom}</span>
                    </label>
                  );
                })}
              </div>
              {cours.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun cours disponible.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 border-t border-ld pt-4">
              <button
                type="submit"
                disabled={enCours}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enCours ? 'Enregistrement…' : edition ? 'Enregistrer les modifications' : 'Créer la formation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEdition(null);
                  setFormulaireOuvert(false);
                }}
                className="rounded-md border border-ld px-5 py-2.5 text-sm font-medium transition hover:bg-lightprimary"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : selection ? (
          <div className="space-y-5">
            <div className="rounded-xl bg-gradient-to-r from-primary to-secondary p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/75">
                    Détail de la formation
                  </p>
                  <h4 className="text-2xl font-semibold">{selection.nom}</h4>
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  {selection.etudiants.length} étudiant
                  {selection.etudiants.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Durée',
                  value: selection.duree,
                  icon: 'solar:clock-circle-linear',
                  color: 'bg-lightprimary text-primary',
                },
                {
                  label: 'Cours associés',
                  value: `${selection.cours.length}`,
                  icon: 'solar:book-bookmark-linear',
                  color: 'bg-lightsuccess text-success',
                },
                {
                  label: 'Étudiants inscrits',
                  value: `${selection.etudiants.length}`,
                  icon: 'solar:users-group-rounded-linear',
                  color: 'bg-lightwarning text-warning',
                },
              ].map((indicateur) => (
                <div
                  key={indicateur.label}
                  className="flex items-center gap-3 rounded-lg border border-ld p-3"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${indicateur.color}`}
                  >
                    <Icon icon={indicateur.icon} height={20} width={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{indicateur.label}</p>
                    <p className="truncate text-sm font-semibold">{indicateur.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-ld p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Description
              </p>
              <p className="text-sm leading-6">
                {selection.description || 'Aucune description disponible.'}
              </p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  label: 'Programme',
                  value: selection.programme || 'Aucun programme associé',
                  icon: 'solar:document-text-linear',
                },
                {
                  label: 'Certification',
                  value: selection.certification || 'Aucune certification associée',
                  icon: 'solar:diploma-verified-linear',
                },
              ].map((information) => (
                <div key={information.label} className="rounded-lg border border-ld p-4">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Icon icon={information.icon} height={17} width={17} className="text-primary" />
                    {information.label}
                  </dt>
                  <dd className="mt-2 text-sm font-medium">{information.value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-lg border border-ld p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cours associés
              </p>
              {selection.cours.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selection.cours.map((nom) => (
                    <span
                      key={nom}
                      className="rounded-full bg-lightprimary px-3 py-1.5 text-xs font-medium text-primary"
                    >
                      {nom}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun cours associé.</p>
              )}
            </div>

            <div className="rounded-lg border border-ld p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Étudiants inscrits
              </p>
              {selection.etudiants.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selection.etudiants.map((nom) => (
                    <span
                      key={nom}
                      className="rounded-full bg-lightsuccess px-3 py-1.5 text-xs font-medium text-success"
                    >
                      {nom}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun étudiant inscrit.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ld">Sélectionnez une formation pour voir ses détails.</p>
        )}
        </CardBox>
      )}
    </div>
  );
};

export default GestionFormations;
