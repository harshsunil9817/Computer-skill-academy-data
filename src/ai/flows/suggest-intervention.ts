'use server';

/**
 * @fileOverview An AI agent that suggests personalized intervention plans for students.
 *
 * - suggestStudentInterventionPlan - A function that generates intervention plans for students.
 * - SuggestStudentInterventionInput - The input type for the suggestStudentInterventionPlan function.
 * - SuggestStudentInterventionOutput - The return type for the suggestStudentInterventionPlan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestStudentInterventionInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  attendancePercentage: z
    .number()
    .describe('The attendance percentage of the student.'),
  grades: z.string().describe('The grades of the student.'),
  paymentHistory: z.string().describe('The payment history of the student.'),
});
export type SuggestStudentInterventionInput = z.infer<
  typeof SuggestStudentInterventionInputSchema
>;

const SuggestStudentInterventionOutputSchema = z.object({
  interventionPlan: z
    .string()
    .describe(
      'A personalized intervention plan for the student, including suggestions for tutoring and payment plan adjustments.'
    ),
});
export type SuggestStudentInterventionOutput = z.infer<
  typeof SuggestStudentInterventionOutputSchema
>;

export async function suggestStudentInterventionPlan(
  input: SuggestStudentInterventionInput
): Promise<SuggestStudentInterventionOutput> {
  return suggestStudentInterventionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestStudentInterventionPrompt',
  input: {schema: SuggestStudentInterventionInputSchema},
  output: {schema: SuggestStudentInterventionOutputSchema},
  prompt: `You are an AI assistant designed to analyze student performance data and suggest personalized intervention plans.

  Based on the student's attendance, grades, and payment history, create an intervention plan to help the student succeed.

  Student Name: {{{studentName}}}
  Attendance Percentage: {{{attendancePercentage}}}
  Grades: {{{grades}}}
  Payment History: {{{paymentHistory}}}

  Intervention Plan:`,
});

const suggestStudentInterventionFlow = ai.defineFlow(
  {
    name: 'suggestStudentInterventionFlow',
    inputSchema: SuggestStudentInterventionInputSchema,
    outputSchema: SuggestStudentInterventionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
