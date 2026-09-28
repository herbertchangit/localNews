type Field = { id: string; type: string; options?: string[] };

export const compatibleRegistrationAnswers = (
  fields: Field[],
  answers: Record<string, unknown>,
) =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const value = answers[field.id];
      if (value === undefined || value === null) return [];
      const options = Array.isArray(field.options) ? field.options : [];
      if (["RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(field.type)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const quantities = Object.fromEntries(
          Object.entries(value).filter(
            ([option, quantity]) =>
              options.includes(option) &&
              Number.isInteger(quantity) &&
              Number(quantity) >= 0 &&
              Number(quantity) <= 999,
          ),
        );
        return Object.keys(quantities).length ? [[field.id, quantities]] : [];
      }
      if (field.type === "CHECKBOX") {
        if (!Array.isArray(value)) return [];
        const selected = value.filter((option) => options.includes(String(option)));
        return selected.length ? [[field.id, selected]] : [];
      }
      if (["RADIO", "SELECT"].includes(field.type) && !options.includes(String(value)))
        return [];
      return [[field.id, value]];
    }),
  );
