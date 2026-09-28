import {
  isRegistrationQuantityAnswer,
  type RegistrationQuantityAnswer,
} from "./registrationAnswers";

export type EditableRegistrationField = {
  id: string;
  title: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export type EditableRegistrationAnswer =
  | string
  | number
  | boolean
  | string[]
  | RegistrationQuantityAnswer;

type Props = {
  fields: EditableRegistrationField[];
  answers: Record<string, EditableRegistrationAnswer>;
  disabled?: boolean;
  onChange: (fieldId: string, value: EditableRegistrationAnswer) => void;
};

export default function RegistrationAnswersEditor({
  fields,
  answers,
  disabled = false,
  onChange,
}: Props) {
  return (
    <div className="registrationAnswersEditor">
      {fields.map((field) => {
        const answer = answers[field.id];
        const options = Array.isArray(field.options) ? field.options : [];
        if (field.type === "CHECKBOX") {
          const selected = Array.isArray(answer) ? answer : [];
          return (
            <fieldset key={field.id}>
              <legend>{field.title}</legend>
              {options.map((option) => (
                <label key={option}>
                  <input
                    disabled={disabled}
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={(event) =>
                      onChange(
                        field.id,
                        event.target.checked
                          ? [...selected, option]
                          : selected.filter((item) => item !== option),
                      )
                    }
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          );
        }
        if (field.type === "RADIO")
          return (
            <fieldset key={field.id}>
              <legend>{field.title}</legend>
              {options.map((option) => (
                <label key={option}>
                  <input
                    disabled={disabled}
                    type="radio"
                    name={`appointment-${field.id}`}
                    checked={answer === option}
                    onChange={() => onChange(field.id, option)}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          );
        if (["RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(field.type)) {
          const quantities = isRegistrationQuantityAnswer(answer) ? answer : {};
          const multiple = field.type === "CHECKBOX_QUANTITY";
          return (
            <fieldset className="registrationAnswerQuantities" key={field.id}>
              <legend>{field.title}</legend>
              {options.map((option) => {
                const selected = Number(quantities[option] || 0) > 0;
                return (
                  <div key={option}>
                    <label>
                      <input
                        disabled={disabled}
                        type={multiple ? "checkbox" : "radio"}
                        name={`appointment-${field.id}`}
                        checked={selected}
                        onChange={(event) => {
                          if (!event.target.checked) {
                            onChange(field.id, { ...quantities, [option]: 0 });
                          } else
                            onChange(
                              field.id,
                              multiple
                                ? { ...quantities, [option]: quantities[option] || 1 }
                                : { [option]: quantities[option] || 1 },
                            );
                        }}
                      />
                      {option}
                    </label>
                    <input
                      aria-label={`${option} quantity`}
                      disabled={disabled || !selected}
                      type="number"
                      min={1}
                      max={999}
                      value={selected ? quantities[option] : ""}
                      onChange={(event) =>
                        onChange(field.id, {
                          ...quantities,
                          [option]: Math.max(
                            1,
                            Math.min(999, Number(event.target.value) || 1),
                          ),
                        })
                      }
                    />
                  </div>
                );
              })}
            </fieldset>
          );
        }
        if (field.type === "SELECT")
          return (
            <label key={field.id}>
              {field.title}
              <select
                disabled={disabled}
                value={String(answer ?? "")}
                onChange={(event) => onChange(field.id, event.target.value)}
              >
                <option value="">Select an option</option>
                {options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          );
        if (field.type === "TEXTAREA")
          return (
            <label key={field.id}>
              {field.title}
              <textarea
                disabled={disabled}
                rows={3}
                maxLength={5000}
                value={String(answer ?? "")}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
            </label>
          );
        return (
          <label key={field.id}>
            {field.title}
            <input
              disabled={disabled}
              type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
              value={String(answer ?? "")}
              onChange={(event) =>
                onChange(
                  field.id,
                  field.type === "NUMBER"
                    ? event.target.value === ""
                      ? ""
                      : Number(event.target.value)
                    : event.target.value,
                )
              }
            />
          </label>
        );
      })}
    </div>
  );
}
