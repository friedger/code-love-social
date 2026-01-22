import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, FileCode } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addContract } from "@/lib/contracts-api";
import { getContractPath } from "@/lib/utils";

const formSchema = z.object({
  network: z.enum(["mainnet", "testnet"], {
    required_error: "Please select a network",
  }),
  txId: z
    .string()
    .min(1, "Transaction ID is required")
    .regex(
      /^0x[a-fA-F0-9]{64}$/,
      "Invalid transaction ID format. Expected 0x followed by 64 hex characters."
    ),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  category: z
    .string()
    .max(50, "Category must be less than 50 characters")
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddContractPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      network: "mainnet",
      txId: "",
      description: "",
      category: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await addContract({
        network: values.network,
        txId: values.txId,
        description: values.description || undefined,
        category: values.category || undefined,
      });

      toast.success("Contract added successfully!");
      
      // Navigate to the new contract page
      const contractPath = getContractPath(
        result.contract.principal,
        result.contract.name
      );
      navigate(`/contract/${contractPath}`);
    } catch (error) {
      console.error("Error adding contract:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add contract");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileCode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Add Contract</CardTitle>
                <CardDescription>
                  Index a contract from Stacks mainnet or testnet by providing its deployment transaction ID.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="network"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Network</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mainnet" id="mainnet" />
                            <Label htmlFor="mainnet" className="cursor-pointer">
                              Mainnet
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="testnet" id="testnet" />
                            <Label htmlFor="testnet" className="cursor-pointer">
                              Testnet
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="txId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0x..."
                          className="font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The transaction hash from the contract deployment.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Description <span className="text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What does this contract do?"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A brief description to help others understand this contract.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Category <span className="text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Token, NFT, DeFi, DAO"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Categorize this contract for easier discovery.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching Contract...
                    </>
                  ) : (
                    "Add Contract"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
