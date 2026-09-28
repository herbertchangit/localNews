type SummaryField = {
  id: string;
  title: string;
  type: string;
  countInSummary?: boolean;
  options?: string[];
};

type SummarySubmission = {
  identity?: string;
  customAnswers?: Record<string, unknown>;
};

const answerTotal = (field: SummaryField, value: unknown) => {
  if (field.type === "NUMBER") {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  if (
    ["RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(field.type) &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (total, quantity) => {
        const number = Number(quantity);
        return total + (Number.isFinite(number) ? number : 0);
      },
      0,
    );
  return 0;
};

const optionTotal = (
  submissions: SummarySubmission[],
  fieldId: string,
  option: string,
) =>
  submissions.reduce((total, submission) => {
    const answer = submission.customAnswers?.[fieldId];
    if (!answer || typeof answer !== "object" || Array.isArray(answer))
      return total;
    const quantity = Number((answer as Record<string, unknown>)[option]);
    return total + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);

const identityTotals = (
  submissions: SummarySubmission[],
  value: (submission: SummarySubmission) => number,
) => ({
  volunteers: submissions
    .filter((submission) => submission.identity === "VOLUNTEER")
    .reduce((total, submission) => total + value(submission), 0),
  nonVolunteers: submissions
    .filter((submission) => submission.identity !== "VOLUNTEER")
    .reduce((total, submission) => total + value(submission), 0),
});

export const registrationFieldSummaries = (
  fields: SummaryField[],
  submissions: SummarySubmission[],
) =>
  fields
    .filter(
      (field) =>
        field.countInSummary &&
        ["NUMBER", "RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(
          field.type,
        ),
    )
    .map((field) => {
      const breakdown = ["RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(
        field.type,
      )
        ? (field.options || []).map((option) => ({
            label: option,
            total: optionTotal(submissions, field.id, option),
            ...identityTotals(submissions, (submission) =>
              optionTotal([submission], field.id, option),
            ),
          }))
        : [];
      const totalsByIdentity = identityTotals(submissions, (submission) =>
        breakdown.length
          ? breakdown.reduce(
              (total, option) =>
                total + optionTotal([submission], field.id, option.label),
              0,
            )
          : answerTotal(field, submission.customAnswers?.[field.id]),
      );
      return {
        id: field.id,
        title: field.title,
        total: breakdown.length
          ? breakdown.reduce((total, option) => total + option.total, 0)
          : submissions.reduce(
              (total, submission) =>
                total +
                answerTotal(field, submission.customAnswers?.[field.id]),
              0,
            ),
        ...totalsByIdentity,
        breakdown,
      };
    });
