import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { Icon } from '@iconify/react';
import CardBox from 'src/components/shared/CardBox';
import { Badge } from 'src/components/ui/badge';
import type { ParcoursStatistiques } from 'src/types/apps/education';

type Props = {
  statistiques: ParcoursStatistiques | null;
  chargement: boolean;
};

const ParcoursStatsWidgets = ({ statistiques, chargement }: Props) => {
  if (chargement && !statistiques) {
    return (
      <div className="grid grid-cols-12 gap-6 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-span-12 sm:col-span-6 xl:col-span-3">
            <CardBox className="p-5 animate-pulse">
              <div className="h-4 w-28 rounded bg-muted mb-3" />
              <div className="h-8 w-16 rounded bg-muted" />
            </CardBox>
          </div>
        ))}
      </div>
    );
  }

  if (!statistiques) return null;

  const kpis = [
    {
      libelle: 'Parcours OWL',
      valeur: statistiques.totalParcours,
      sousTitre: `${statistiques.parStatut.publie} publié(s) · ${statistiques.parStatut.brouillon} brouillon(s)`,
      icone: 'solar:routing-2-linear',
      couleur: 'bg-lightprimary text-primary',
    },
    {
      libelle: 'Inscriptions actives',
      valeur: statistiques.totalInscriptions,
      sousTitre: `Progression moy. : ${statistiques.progressionMoyenne}%`,
      icone: 'solar:users-group-two-rounded-linear',
      couleur: 'bg-lightsuccess text-success',
    },
    {
      libelle: 'Volume moyen',
      valeur: `${statistiques.moyenneHeuresParParcours} h`,
      sousTitre: `${statistiques.moyenneCoursParParcours} cours / parcours`,
      icone: 'solar:clock-circle-linear',
      couleur: 'bg-lightinfo text-info',
    },
    {
      libelle: 'Taux de complétion',
      valeur: `${statistiques.tauxCompletionGlobal}%`,
      sousTitre: 'Validé via évaluations OWL',
      icone: 'solar:diploma-verified-linear',
      couleur: 'bg-lightwarning text-warning',
    },
  ];

  const donutSeries = [
    statistiques.parNiveau.Debutant,
    statistiques.parNiveau.Avance,
  ];

  const donutOptions: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'inherit',
      toolbar: { show: false },
    },
    labels: ['Parcours Débutant', 'Parcours Avancé'],
    colors: ['#5D87FF', '#49BEFF'],
    legend: {
      position: 'bottom',
      fontSize: '13px',
    },
    dataLabels: { enabled: true },
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Parcours',
              formatter: () => String(statistiques.totalParcours),
            },
          },
        },
      },
    },
    stroke: { width: 2 },
  };

  const top = statistiques.topParcours.slice(0, 6);
  const barOptions: ApexOptions = {
    chart: {
      type: 'bar',
      fontFamily: 'inherit',
      toolbar: { show: false },
    },
    colors: ['#5D87FF', '#13DEB9'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '46%',
        borderRadius: 5,
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: top.map((p) =>
        p.nom.length > 18 ? `${p.nom.slice(0, 18)}…` : p.nom,
      ),
      labels: { style: { fontSize: '12px' } },
    },
    yaxis: [
      {
        title: { text: 'Inscrits' },
        min: 0,
        forceNiceScale: true,
        decimalsInFloat: 0,
      },
      {
        opposite: true,
        title: { text: 'Progression (%)' },
        min: 0,
        max: 100,
        decimalsInFloat: 0,
      },
    ],
    legend: { position: 'top', horizontalAlign: 'right' },
    tooltip: { shared: true, intersect: false },
  };

  const barSeries = [
    {
      name: 'Étudiants inscrits',
      data: top.map((p) => p.nombreInscrits),
    },
    {
      name: 'Progression moyenne (%)',
      data: top.map((p) => p.progressionMoyenne),
    },
  ];

  return (
    <div className="space-y-6 mb-6">
      {/* Cartes KPI */}
      <div className="grid grid-cols-12 gap-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.libelle}
            className="col-span-12 sm:col-span-6 xl:col-span-3"
          >
            <CardBox className="p-5 h-full">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {kpi.libelle}
                  </p>
                  <h3 className="text-2xl font-bold">{kpi.valeur}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpi.sousTitre}
                  </p>
                </div>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${kpi.couleur}`}
                >
                  <Icon icon={kpi.icone} height={22} width={22} />
                </span>
              </div>
            </CardBox>
          </div>
        ))}
      </div>

      {/* Graphiques ApexCharts + cours mutualisés */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <CardBox className="p-5 h-full flex flex-col justify-between">
            <div>
              <h4 className="text-base font-semibold">
                Répartition sémantique (OWL)
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Sous-classes directes de <code>edu:ParcoursApprentissage</code>
              </p>
              {statistiques.totalParcours > 0 ? (
                <Chart
                  options={donutOptions}
                  series={donutSeries}
                  type="donut"
                  height={240}
                />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun parcours enregistré.
                </p>
              )}
            </div>

            {statistiques.coursPartages.length > 0 && (
              <div className="pt-3 border-t border-ld mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Cours les plus mutualisés (<code>contientCoursParcours</code>)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {statistiques.coursPartages.slice(0, 5).map((cp) => (
                    <Badge key={cp.coursId} variant="lightPrimary">
                      {cp.coursNom} · {cp.nombreParcours} parcours
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardBox>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <CardBox className="p-5 h-full">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <h4 className="text-base font-semibold">
                  Attractivité &amp; progression par parcours
                </h4>
                <p className="text-xs text-muted-foreground">
                  Inscriptions étudiantes et avancement dérivé des évaluations
                </p>
              </div>
            </div>
            {top.length > 0 ? (
              <Chart
                options={barOptions}
                series={barSeries}
                type="bar"
                height={265}
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Aucune donnée disponible.
              </p>
            )}
          </CardBox>
        </div>
      </div>
    </div>
  );
};

export default ParcoursStatsWidgets;

