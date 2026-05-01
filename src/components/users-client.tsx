"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import {
  RiAddLine,
  RiMore2Fill,
  RiShieldUserLine,
  RiSettings4Line,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  createUserAction,
  updateUserRoleAction,
  toggleUserActiveAction,
  setUserModulesAction,
} from "@/actions/users.actions";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Form Schemas
const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["reporter", "agent", "engineer", "admin"]),
  moduleIds: z.array(z.string()),
});

const editUserSchema = z.object({
  role: z.enum(["reporter", "agent", "engineer", "admin"]),
  moduleIds: z.array(z.string()),
});

type CreateUserValues = z.infer<typeof createUserSchema>;
type EditUserValues = z.infer<typeof editUserSchema>;

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  phone: string | null;
  createdAt: Date;
  modules: {
    module: {
      id: string;
      name: string;
      color: string | null;
    };
  }[];
};

type Module = {
  id: string;
  name: string;
  color: string | null;
};

interface UsersClientProps {
  initialUsers: User[];
  modules: Module[];
}

export function UsersClient({ initialUsers, modules }: UsersClientProps) {
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);

  // Add User Form
  const addForm = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "agent",
      moduleIds: [],
    },
  });

  // Edit User Form
  const editForm = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      role: "agent",
      moduleIds: [],
    },
  });

  const onAddSubmit = async (values: CreateUserValues) => {
    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("email", values.email);
    formData.append("password", values.password);
    formData.append("role", values.role);
    values.moduleIds.forEach((id) => formData.append("moduleIds", id));

    try {
      const result = await createUserAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("User berhasil ditambahkan");
      setIsAddDialogOpen(false);
      addForm.reset();
      router.refresh();
    } catch (error) {
      toast.error("Terjadi kesalahan");
    }
  };

  const onEditSubmit = async (values: EditUserValues) => {
    if (!editingUser) return;

    try {
      if (values.role !== editingUser.role) {
        await updateUserRoleAction(editingUser.id, values.role as any);
      }
      await setUserModulesAction(editingUser.id, values.moduleIds);

      toast.success("User berhasil diperbarui");
      setIsEditDialogOpen(false);
      setEditingUser(null);
      router.refresh();
    } catch (error) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      role: user.role as any,
      moduleIds: user.modules.map((m) => m.module.id),
    });
    setIsEditDialogOpen(true);
  };

  const handleToggleActive = async (userId: string) => {
    try {
      const result = await toggleUserActiveAction(userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Status user berhasil diubah");
      router.refresh();
    } catch (error) {
      toast.error("Terjadi kesalahan");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Admin</Badge>;
      case "engineer":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Engineer</Badge>;
      case "agent":
        return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Agent</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">Reporter</Badge>;
    }
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: "Nama & Email",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => getRoleBadge(row.getValue("role")),
    },
    {
      id: "modules",
      header: "Modul",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {user.modules.length > 0 ? (
              user.modules.map((m) => (
                <Badge
                  key={m.module.id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5"
                  style={{ 
                    borderColor: m.module.color || "#e2e8f0",
                    color: m.module.color || "inherit"
                  }}
                >
                  {m.module.name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">Semua</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("isActive") as boolean;
        return (
          <div className="flex items-center gap-2">
            {isActive ? (
              <RiCheckboxCircleLine className="size-4 text-green-500" />
            ) : (
              <RiCloseCircleLine className="size-4 text-red-500" />
            )}
            <span className={`text-xs ${isActive ? "text-green-600" : "text-red-600"}`}>
              {isActive ? "Aktif" : "Nonaktif"}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <RiMore2Fill className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Aksi User</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                  <RiShieldUserLine className="mr-2 size-4" />
                  Edit Role & Modul
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleActive(user.id)}>
                  <RiSettings4Line className="mr-2 size-4" />
                  {user.isActive ? "Nonaktifkan User" : "Aktifkan User"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold sr-only">Daftar Pengguna</h2>
        <Button onClick={() => setIsAddDialogOpen(true)} className="ml-auto">
          <RiAddLine className="mr-2 size-4" />
          Tambah User
        </Button>
      </div>

      <DataTable 
        columns={columns} 
        data={initialUsers} 
        searchKey="name" 
        searchPlaceholder="Cari user (nama atau email)..."
      />

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah User Baru</DialogTitle>
            <DialogDescription>
              Buat akun user baru untuk Agent, Engineer, atau Admin.
            </DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 py-2">
              <FormField
                control={addForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Budi Santoso" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="budi@rsud.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Sementara</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="reporter">Reporter</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="engineer">Engineer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {addForm.watch("role") !== "reporter" && (
                <FormField
                  control={addForm.control}
                  name="moduleIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Akses Modul</FormLabel>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-md">
                        {modules.map((module) => (
                          <div
                            key={module.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <Checkbox
                              checked={field.value?.includes(module.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, module.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== module.id
                                      )
                                    )
                              }}
                            />
                            <Label className="text-xs font-normal cursor-pointer leading-none">
                              {module.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={addForm.formState.isSubmitting}>
                  {addForm.formState.isSubmitting ? "Menyimpan..." : "Tambah User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.name}</DialogTitle>
            <DialogDescription>
              Ubah role dan akses modul untuk user ini.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="reporter">Reporter</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="engineer">Engineer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="moduleIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Akses Modul</FormLabel>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-md">
                      {modules.map((module) => (
                        <div
                          key={module.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <Checkbox
                            checked={field.value?.includes(module.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, module.id])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== module.id
                                    )
                                  )
                            }}
                          />
                          <Label className="text-xs font-normal cursor-pointer leading-none">
                            {module.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
