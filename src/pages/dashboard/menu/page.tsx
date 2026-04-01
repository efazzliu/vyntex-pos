import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  UtensilsCrossed,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Add Category Dialog ────────────────────────────────────

function AddCategoryDialog({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const createCategory = useMutation(api.dashboard.menu.createCategory);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createCategory({ name: name.trim() });
      toast.success("Category created");
      setName("");
      setOpen(false);
      onCreated?.();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to create category");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <FolderPlus className="size-4 mr-1.5" />
          Category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category Name</Label>
            <Input
              placeholder="e.g. Appetizers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Add/Edit Menu Item Dialog ──────────────────────────────

function MenuItemDialog({
  categories,
  editItem,
  defaultCategoryId,
  trigger,
}: {
  categories: Doc<"menuCategories">[];
  editItem?: Doc<"menuItems">;
  defaultCategoryId?: Id<"menuCategories">;
  trigger: React.ReactNode;
}) {
  const createMenuItem = useMutation(api.dashboard.menu.createMenuItem);
  const updateMenuItem = useMutation(api.dashboard.menu.updateMenuItem);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editItem?.name ?? "");
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [priceStr, setPriceStr] = useState(
    editItem ? (editItem.price / 100).toFixed(2) : ""
  );
  const [categoryId, setCategoryId] = useState<Id<"menuCategories"> | "">(
    editItem?.categoryId ?? defaultCategoryId ?? ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) {
      toast.error("Fill in all required fields");
      return;
    }
    const price = Math.round(parseFloat(priceStr) * 100);
    if (isNaN(price) || price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setLoading(true);
    try {
      if (editItem) {
        await updateMenuItem({
          id: editItem._id,
          name: name.trim(),
          description: description.trim() || undefined,
          price,
          categoryId: categoryId as Id<"menuCategories">,
        });
        toast.success("Menu item updated");
      } else {
        await createMenuItem({
          name: name.trim(),
          description: description.trim() || undefined,
          price,
          categoryId: categoryId as Id<"menuCategories">,
        });
        toast.success("Menu item created");
        setName("");
        setDescription("");
        setPriceStr("");
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save menu item");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Edit Menu Item" : "Add Menu Item"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              placeholder="e.g. Margherita Pizza"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="Fresh tomato, mozzarella, basil"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="12.99"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={categoryId as string}
                onValueChange={(v) =>
                  setCategoryId(v as Id<"menuCategories">)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat._id} value={cat._id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : editItem ? "Update Item" : "Add Item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardMenu() {
  const categories = useQuery(api.dashboard.menu.getCategories);
  const menuItems = useQuery(api.dashboard.menu.getMenuItems);
  const toggleAvailability = useMutation(api.dashboard.menu.toggleAvailability);
  const deleteMenuItem = useMutation(api.dashboard.menu.deleteMenuItem);
  const deleteCategory = useMutation(api.dashboard.menu.deleteCategory);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  if (categories === undefined || menuItems === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const filteredItems =
    activeCategory === "all"
      ? menuItems
      : menuItems.filter((item) => item.categoryId === activeCategory);

  const handleDelete = async (id: Id<"menuItems">) => {
    try {
      await deleteMenuItem({ id });
      toast.success("Menu item deleted");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete item");
      }
    }
  };

  const handleDeleteCategory = async (id: Id<"menuCategories">) => {
    const itemCount = menuItems.filter((i) => i.categoryId === id).length;
    if (
      itemCount > 0 &&
      !window.confirm(
        `This will also delete ${itemCount} menu item(s). Continue?`
      )
    ) {
      return;
    }
    try {
      await deleteCategory({ id });
      toast.success("Category deleted");
      if (activeCategory === id) setActiveCategory("all");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete category");
      }
    }
  };

  const getCategoryName = (categoryId: Id<"menuCategories">) =>
    categories.find((c) => c._id === categoryId)?.name ?? "Unknown";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu</h1>
          <p className="text-sm text-muted-foreground">
            Manage your categories and menu items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddCategoryDialog />
          {categories.length > 0 && (
            <MenuItemDialog
              categories={categories}
              trigger={
                <Button size="sm">
                  <Plus className="size-4 mr-1.5" />
                  Menu Item
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border transition-colors shrink-0 cursor-pointer",
              activeCategory === "all"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            All ({menuItems.length})
          </button>
          {categories.map((cat) => {
            const count = menuItems.filter(
              (i) => i.categoryId === cat._id
            ).length;
            return (
              <div key={cat._id} className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setActiveCategory(cat._id)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer",
                    activeCategory === cat._id
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {cat.name} ({count})
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded hover:bg-accent text-muted-foreground cursor-pointer">
                      <MoreVertical className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDeleteCategory(cat._id)}
                    >
                      <Trash2 className="size-4 mr-2" />
                      Delete Category
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Menu items grid */}
      {categories.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UtensilsCrossed />
            </EmptyMedia>
            <EmptyTitle>No menu categories yet</EmptyTitle>
            <EmptyDescription>
              Create a category first, then add menu items to it.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddCategoryDialog />
          </EmptyContent>
        </Empty>
      ) : filteredItems.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UtensilsCrossed />
            </EmptyMedia>
            <EmptyTitle>No items in this category</EmptyTitle>
            <EmptyDescription>Add your first menu item.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <MenuItemDialog
              categories={categories}
              defaultCategoryId={
                activeCategory !== "all"
                  ? (activeCategory as Id<"menuCategories">)
                  : undefined
              }
              trigger={
                <Button size="sm">
                  <Plus className="size-4 mr-1.5" />
                  Add Item
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item._id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm",
                !item.isAvailable && "opacity-60",
                item.isAvailable ? "border-border" : "border-dashed border-border"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryName(item.categoryId)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded hover:bg-accent text-muted-foreground cursor-pointer shrink-0">
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <MenuItemDialog
                      categories={categories}
                      editItem={item}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      }
                    />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDelete(item._id)}
                    >
                      <Trash2 className="size-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                <span className="text-base font-bold text-foreground">
                  {formatCurrency(item.price)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {item.isAvailable ? "Available" : "Unavailable"}
                  </span>
                  <Switch
                    checked={item.isAvailable}
                    onCheckedChange={() =>
                      toggleAvailability({ id: item._id })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
