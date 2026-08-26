// §4 — les 15 points du §8.3 du cahier des charges, instanciés en LIGNES
// (mission_checklist_items) à la création de chaque mission — jamais des
// booléens sur Mission. Le texte exact du §8.3 n'étant pas reproduit dans
// ce prompt, cette liste est une opérationnalisation raisonnable du cycle
// de vie décrit en §2/§3 (devis → contrat → acompte → logistique →
// livraison → paiement), au même esprit que les autres "hypothèses
// raisonnables" de ce projet quand une énumération exacte n'est pas
// donnée : à ajuster si l'équipe a une liste différente en tête — c'est
// justement pour ça que ce sont des LIGNES et pas des colonnes fixes,
// l'admin peut ajouter un point propre à une mission sans migration.
export interface MissionChecklistTemplateItem {
  code: string;
  label: string;
  displayOrder: number;
}

export const MISSION_CHECKLIST_TEMPLATE: MissionChecklistTemplateItem[] = [
  {
    code: 'availability_confirmed',
    label: 'Disponibilité du speaker confirmée',
    displayOrder: 0,
  },
  { code: 'quote_sent', label: 'Devis envoyé au client', displayOrder: 1 },
  {
    code: 'quote_accepted',
    label: 'Devis accepté par le client',
    displayOrder: 2,
  },
  { code: 'contract_sent', label: 'Contrat envoyé', displayOrder: 3 },
  { code: 'contract_signed', label: 'Contrat signé reçu', displayOrder: 4 },
  { code: 'deposit_requested', label: 'Acompte demandé', displayOrder: 5 },
  { code: 'deposit_received', label: 'Acompte reçu', displayOrder: 6 },
  { code: 'brief_sent', label: 'Brief envoyé au speaker', displayOrder: 7 },
  {
    code: 'brief_acknowledged',
    label: 'Lecture du brief confirmée par le speaker',
    displayOrder: 8,
  },
  {
    code: 'travel_arranged',
    label: 'Déplacement du speaker organisé (vol/hôtel)',
    displayOrder: 9,
  },
  {
    code: 'onsite_logistics_confirmed',
    label:
      'Informations logistiques sur site confirmées (contact, horaires, salle/lien)',
    displayOrder: 10,
  },
  {
    code: 'presentation_received',
    label: 'Présentation reçue du speaker',
    displayOrder: 11,
  },
  {
    code: 'final_invoice_sent',
    label: 'Facture finale envoyée au client',
    displayOrder: 12,
  },
  {
    code: 'final_payment_received',
    label: 'Paiement final du client reçu',
    displayOrder: 13,
  },
  {
    code: 'speaker_paid',
    label: 'Paiement du speaker traité',
    displayOrder: 14,
  },
];
