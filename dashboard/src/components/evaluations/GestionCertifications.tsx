import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { Checkbox } from 'src/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'src/components/ui/table';
import CardBox from 'src/components/shared/CardBox';
import educationAPI from 'src/api/education/education-data';
import type {
  CertificationType,
  Competence,
  Etudiant,
  Evaluation,
  Formation,
} from 'src/types/apps/education';
import { useAuth } from 'src/context/auth-context';

const AUCUN = '__aucun__';

const TYPES: { valeur: string; libelle: string }[] = [
  { valeur: 'CertificationCompetence', libelle: 'Certification de compétence' },
  { valeur: 'Certification', libelle: 'Certification' },
  {
    valeur: 'CertificationProfessionnelle',
    libelle: 'Certification professionnelle',
  },
  { valeur: 'CertificationTechnique', libelle: 'Certification technique' },
];

/** Retire les doublons renvoyés par le graphe (même nom local). */
const uniques = <T extends { id: string }>(liste: T[]): T[] => {
  const vus = new Set<string>();
  return liste.filter((item) => {
    if (!item.id || vus.has(item.id)) return false;
    vus.add(item.id);
    return true;
  });
};

const versValeurType = (type: string | null) => {
  if (type === 'Certification de compétence') return 'CertificationCompetence';
  if (type === 'Certification Professionnelle') {
    return 'CertificationProfessionnelle';
  }
  if (type === 'Certification Technique') return 'CertificationTechnique';
  return 'Certification';
};

const aujourdhui = () => {
  const date = new Date();
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()}`;
};

const versNombre = (valeur: string, defaut: number): number => {
  const nombre = Number(valeur.replace(',', '.'));
  return Number.isFinite(nombre) ? nombre : defaut;
};

const GestionCertifications = () => {
  const { utilisateur } = useAuth();
  const peutEditer =
    utilisateur?.role === 'admin' || utilisateur?.role === 'formateur';
  const estEtudiant = utilisateur?.role === 'etudiant';

  const [certifications, setCertifications] = useState<CertificationType[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [ouvert, setOuvert] = useState(false);
  const [idEdition, setIdEdition] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [organisme, setOrganisme] = useState('');
  const [type, setType] = useState('CertificationCompetence');
  const [competenceChoisie, setCompetenceChoisie] = useState(AUCUN);
  const [evaluationChoisie, setEvaluationChoisie] = useState(AUCUN);
  const [seuil, setSeuil] = useState('14');
  const [formationChoisie, setFormationChoisie] = useState(AUCUN);
  const [dateObtention, setDateObtention] = useState('');
  const [etudiantsChoisis, setEtudiantsChoisis] = useState<string[]>([]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const [
        liste,
        listeFormations,
        listeEtudiants,
        listeCompetences,
      ] = await Promise.all([
        educationAPI.certifications(),
        educationAPI.formations(),
        educationAPI.etudiants(),
        educationAPI.competences(),
      ]);
      // La liste nominative des évaluations est réservée aux encadrants.
      const listeEvaluations = estEtudiant
        ? []
        : await educationAPI.evaluations();
      setCertifications(liste);
      setFormations(uniques(listeFormations));
      setEtudiants(uniques(listeEtudiants));
      setCompetences(uniques(listeCompetences));
      setEvaluations(uniques(listeEvaluations));
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'Chargement des certifications impossible.',
      );
    } finally {
      setChargement(false);
    }
  }, [estEtudiant]);

  useEffect(() => {
    charger();
  }, [charger]);

  /** L'étudiant ne voit que les certifications qui lui ont été attribuées. */
  const certificationsAffichees = useMemo(() => {
    if (!estEtudiant) return certifications;
    const individu = `compte_${utilisateur?.id ?? 0}`;
    return certifications.filter((certification) =>
      certification.etudiantIds.includes(individu),
    );
  }, [certifications, estEtudiant, utilisateur?.id]);

  const evaluationSelectionnee = useMemo(
    () => evaluations.find((item) => item.id === evaluationChoisie) ?? null,
    [evaluations, evaluationChoisie],
  );

  const seuilNombre = versNombre(seuil, 14);
  const noteEvaluation = evaluationSelectionnee?.note ?? null;

  const condition = useMemo(() => {
    if (!evaluationSelectionnee) return null;
    if (noteEvaluation === null) return 'sans-note' as const;
    return noteEvaluation >= seuilNombre ? ('ok' as const) : ('ko' as const);
  }, [evaluationSelectionnee, noteEvaluation, seuilNombre]);

  const peutAttribuer = condition === null || condition === 'ok';

  const ouvrirCreation = () => {
    setIdEdition(null);
    setNom('');
    setOrganisme('');
    setType('CertificationCompetence');
    setCompetenceChoisie(AUCUN);
    setEvaluationChoisie(AUCUN);
    setSeuil('14');
    setFormationChoisie(AUCUN);
    setDateObtention(aujourdhui());
    setEtudiantsChoisis([]);
    setErreur('');
    setOuvert(true);
  };

  const ouvrirEdition = (certification: CertificationType) => {
    setIdEdition(certification.id);
    setNom(certification.nom);
    setOrganisme(certification.organisme ?? '');
    setType(versValeurType(certification.type));
    setCompetenceChoisie(certification.competenceId ?? AUCUN);
    setEvaluationChoisie(certification.evaluationId ?? AUCUN);
    setSeuil(String(certification.seuil ?? 14));
    setFormationChoisie(certification.formationId ?? AUCUN);
    setDateObtention(certification.dateObtention ?? '');
    setEtudiantsChoisis(certification.etudiantIds ?? []);
    setErreur('');
    setOuvert(true);
  };

  const basculerEtudiant = (id: string, coche: boolean) => {
    setEtudiantsChoisis((liste) =>
      coche ? [...liste, id] : liste.filter((item) => item !== id),
    );
  };

  const enregistrer = async () => {
    if (nom.trim().length < 2) {
      setErreur('Le nom de la certification est trop court.');
      return;
    }
    if (etudiantsChoisis.length > 0 && !evaluationSelectionnee) {
      setErreur(
        'Choisissez l’évaluation associée avant d’attribuer la certification.',
      );
      return;
    }
    if (etudiantsChoisis.length > 0 && condition === 'ko') {
      setErreur(
        `Condition d'obtention non satisfaite : ${noteEvaluation} < ${seuilNombre}.`,
      );
      return;
    }
    setEnCours(true);
    setErreur('');
    try {
      const donnees = {
        nom: nom.trim(),
        organisme: organisme.trim() || null,
        type,
        competence:
          competenceChoisie === AUCUN ? null : competenceChoisie,
        evaluation:
          evaluationChoisie === AUCUN ? null : evaluationChoisie,
        seuil: seuilNombre,
        formation: formationChoisie === AUCUN ? null : formationChoisie,
        date_obtention: dateObtention.trim() || null,
        etudiants: etudiantsChoisis,
      };
      if (idEdition) {
        await educationAPI.modifierCertification(idEdition, donnees);
      } else {
        await educationAPI.creerCertification(donnees);
      }
      setOuvert(false);
      await charger();
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Enregistrement impossible.',
      );
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (certification: CertificationType) => {
    if (!window.confirm(`Supprimer la certification « ${certification.nom} » ?`)) {
      return;
    }
    setErreur('');
    try {
      await educationAPI.supprimerCertification(certification.id);
      setCertifications((liste) =>
        liste.filter((item) => item.id !== certification.id),
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suppression impossible.');
    }
  };

  return (
    <CardBox className="p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold">
            {estEtudiant ? 'Mes certifications' : 'Certifications'}
          </h4>
          <p className="text-sm text-muted-foreground">
            {estEtudiant
              ? 'Certifications obtenues après réussite de l’évaluation associée.'
              : "Attribuées après réussite de l'évaluation associée (note ≥ seuil)."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {certificationsAffichees.length} certification(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={charger} disabled={chargement}>
            Recharger
          </Button>
          {peutEditer && (
            <Button size="sm" onClick={ouvrirCreation}>
              Ajouter une certification
            </Button>
          )}
        </div>
      </div>

      {erreur && !ouvert && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-lighterror px-3 py-2 text-sm text-error"
        >
          {erreur}
        </p>
      )}

      {chargement ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chargement des certifications…
        </p>
      ) : certificationsAffichees.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {estEtudiant
            ? 'Aucune certification ne vous a encore été attribuée.'
            : "Aucune certification enregistrée dans l'ontologie."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Compétence</TableHead>
                <TableHead>Évaluation</TableHead>
                <TableHead>Seuil</TableHead>
                {!estEtudiant && <TableHead>Étudiants</TableHead>}
                {peutEditer && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificationsAffichees.map((certification) => (
                <TableRow key={certification.id}>
                  <TableCell className="font-medium">
                    {certification.nom}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-lightprimary px-2 py-0.5 text-xs font-medium text-primary">
                      {certification.type ?? 'Certification'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {certification.competence ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {certification.evaluationNom ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {certification.seuil === null
                      ? '—'
                      : `${certification.seuil}/20`}
                  </TableCell>
                  {!estEtudiant && (
                    <TableCell
                      className="max-w-[180px] truncate text-muted-foreground"
                      title={certification.etudiants.join(', ')}
                    >
                      {certification.etudiants.length > 0
                        ? certification.etudiants.join(', ')
                        : '—'}
                    </TableCell>
                  )}
                  {peutEditer && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => ouvrirEdition(certification)}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="lighterror"
                          onClick={() => supprimer(certification)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {idEdition ? 'Modifier la certification' : 'Nouvelle certification'}
            </DialogTitle>
            <DialogDescription>
              La certification est enregistrée dans l'ontologie avec sa
              compétence, son évaluation et les étudiants certifiés.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nom-certification" className="mb-2 block">
                Nom
              </Label>
              <Input
                id="nom-certification"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Certification Angular"
              />
            </div>

            <div>
              <Label className="mb-2 block">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((option) => (
                    <SelectItem key={option.valeur} value={option.valeur}>
                      {option.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="organisme" className="mb-2 block">
                Organisme (facultatif)
              </Label>
              <Input
                id="organisme"
                value={organisme}
                onChange={(e) => setOrganisme(e.target.value)}
                placeholder="Centre de Formation"
              />
            </div>

            <div>
              <Label className="mb-2 block">Compétence associée</Label>
              <Select
                value={competenceChoisie}
                onValueChange={setCompetenceChoisie}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUN}>— Aucune —</SelectItem>
                  {competences.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Évaluation associée</Label>
              <Select
                value={evaluationChoisie}
                onValueChange={setEvaluationChoisie}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUN}>— Aucune —</SelectItem>
                  {evaluations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nom}
                      {item.note === null ? '' : ` (${item.note}/${item.noteMax})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="seuil" className="mb-2 block">
                Condition d'obtention — note minimale
              </Label>
              <Input
                id="seuil"
                type="number"
                min={0}
                step="0.5"
                value={seuil}
                onChange={(e) => setSeuil(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="date-obtention" className="mb-2 block">
                Date d'obtention
              </Label>
              <Input
                id="date-obtention"
                value={dateObtention}
                onChange={(e) => setDateObtention(e.target.value)}
                placeholder="JJ/MM/AAAA"
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="mb-2 block">Formation (facultatif)</Label>
              <Select
                value={formationChoisie}
                onValueChange={setFormationChoisie}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUN}>— Aucune —</SelectItem>
                  {formations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              {evaluationSelectionnee && (
                <div
                  className={`mb-3 rounded-md px-3 py-2 text-sm ${
                    condition === 'ok'
                      ? 'bg-lightsuccess text-success'
                      : condition === 'ko'
                        ? 'bg-lighterror text-error'
                        : 'bg-lightwarning text-warning'
                  }`}
                >
                  {condition === 'sans-note' && (
                    <>
                      Aucun résultat enregistré pour «&nbsp;
                      {evaluationSelectionnee.nom}&nbsp;» : saisissez d'abord la
                      note obtenue dans le module Évaluations.
                    </>
                  )}
                  {condition === 'ok' && (
                    <>
                      Condition satisfaite : {noteEvaluation}/
                      {evaluationSelectionnee.noteMax} ≥ seuil {seuilNombre}.
                      L'attribution de la certification est possible.
                    </>
                  )}
                  {condition === 'ko' && (
                    <>
                      Condition non satisfaite : {noteEvaluation}/
                      {evaluationSelectionnee.noteMax} &lt; seuil {seuilNombre}.
                    </>
                  )}
                </div>
              )}

              <Label className="mb-2 block">Étudiants certifiés</Label>
              {etudiants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun étudiant dans l'ontologie.
                </p>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-ld p-3">
                  {etudiants.map((etudiant) => (
                    <label
                      key={etudiant.id}
                      className={`flex items-center gap-2 text-sm ${
                        peutAttribuer ? 'cursor-pointer' : 'opacity-50'
                      }`}
                    >
                      <Checkbox
                        checked={etudiantsChoisis.includes(etudiant.id)}
                        disabled={!peutAttribuer}
                        onCheckedChange={(coche) =>
                          basculerEtudiant(etudiant.id, coche === true)
                        }
                      />
                      {etudiant.prenom}
                    </label>
                  ))}
                </div>
              )}
              {!peutAttribuer && (
                <p className="mt-2 text-xs text-error">
                  Attribution bloquée tant que la condition d'obtention n'est
                  pas remplie.
                </p>
              )}
            </div>
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-md bg-lighterror px-3 py-2 text-sm text-error"
            >
              {erreur}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={enregistrer} disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardBox>
  );
};

export default GestionCertifications;
