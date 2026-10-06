export const peopleWhereForHarmony = ({
  admin,
  harmonyGroupId,
}: {
  admin: boolean;
  harmonyGroupId?: string | null;
}) =>
  admin
    ? {}
    : {
        harmonyGroupId: harmonyGroupId || "__unassigned__",
        NOT: { OR: [{ role: "ADMIN" }, { roles: { has: "ADMIN" } }] },
      };

export const hasPeopleHarmony = ({
  admin,
  harmonyGroupId,
}: {
  admin: boolean;
  harmonyGroupId?: string | null;
}) => admin || Boolean(harmonyGroupId);
