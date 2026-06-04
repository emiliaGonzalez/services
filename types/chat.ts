export type MessageRole = "ai" | "user";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

export type PricingModel = "fixed" | "per_person" | "per_unit";

export interface PriceRange {
  from: number;
  to: number;
  price: number;
}

export interface OptionGroupOption {
  name: string;
  prices: Record<string, number>;
}

export interface OptionGroup {
  id: string;
  name: string;
  pricingMode: "fixed" | "per_pax";
  dependsOn: string | null;
  options: OptionGroupOption[];
}

export interface ServiceDraft {
  name: string;
  category: string;
  description: string;
  locations: string[];
  photos: string[];
  pricingModel: PricingModel;
  variableByHeadcount: boolean;
  basePrice: number;
  priceRanges: PriceRange[];
  optionGroups: OptionGroup[];
}

export type StepType = "simple" | "options" | "form";

export interface Step {
  id: string;
  aiMessage: string;
  type: StepType;
  field: keyof ServiceDraft | null;
  options?: { label: string; value: string }[];
}
