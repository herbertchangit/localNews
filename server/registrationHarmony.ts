export const registrationFormWhereForHarmony = ({
  harmonyGroupId,
  userId,
}: {
  harmonyGroupId?: string | null;
  userId: string;
}) => {
  const normalizedHarmonyGroupId = harmonyGroupId?.trim();
  return normalizedHarmonyGroupId
    ? { creator: { harmonyGroupId: normalizedHarmonyGroupId } }
    : { creatorId: userId };
};

export const registrationSubmissionWhereForHarmony = (scope: {
  harmonyGroupId?: string | null;
  userId: string;
}) => ({ form: registrationFormWhereForHarmony(scope) });
