"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createApiKeyAction } from "./actions";
import { useRouter } from "next/navigation";
import { RiCheckFill, RiCopyleftFill } from "@remixicon/react";

export function GenerateKeyDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState<string>("0"); // "0" means never
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    if (!name) return;
    setLoading(true);
    try {
      const days = expiresIn === "0" ? undefined : parseInt(expiresIn, 10);
      const result = await createApiKeyAction(name, days);
      setGeneratedKey(result.rawKey);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to generate API Key");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closed
      setTimeout(() => {
        setGeneratedKey(null);
        setName("");
        setExpiresIn("0");
        setCopied(false);
      }, 300);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <RiCopyleftFill className="size-4" />
          Generate New Key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {!generatedKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Generate API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to programmatically interact with SalamDesk.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Key Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., SIMRS Core System"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiration">Expiration</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger id="expiration">
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Never expires</SelectItem>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleGenerate} disabled={loading || !name}>
                {loading ? "Generating..." : "Generate Key"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>API Key Generated</DialogTitle>
              <DialogDescription className="text-destructive font-medium">
                Please copy this key and store it somewhere safe. You will not be able to see it again!
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 my-4">
              <Input
                readOnly
                value={generatedKey}
                className="font-mono text-sm bg-muted/50 text-foreground"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="shrink-0"
                onClick={copyToClipboard}
              >
                {copied ? <RiCheckFill className="size-4" /> : <RiCopyleftFill className="size-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
