// Ne contient QUE les champs réellement différents (cf. §6) — ni les champs
// scalaires identiques, ni les éléments de relation inchangés.
export class FieldDiffDto {
  field!: string;
  label!: string;
  before!: unknown;
  after!: unknown;
}

export class RelationDiffDto {
  field!: string;
  label!: string;
  added!: string[];
  removed!: string[];
}

export class SpeakerRevisionDiffDto {
  scalarChanges!: FieldDiffDto[];
  relationChanges!: RelationDiffDto[];
}
