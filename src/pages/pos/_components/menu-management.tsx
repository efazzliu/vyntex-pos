import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Package,
  ChevronRight,
} from "lucide-react";
import CategoryDialog from "./category-dialog.tsx";
import ItemDialog from "./item-dialog.tsx";

type CategoryData = {
  _id: Id<"menuCategories">;
  name: string;
  color: string;
  isActive: boolean;
};

type MenuManagementProps = {
  licenseKey: string;
};

export default function MenuManagement({ licenseKey }: MenuManagementProps) {
  const categories = useQuery(api.pos.menu.getCategories, { licenseKey });
  const allItems = useQuery(api.pos.menu.getAllItems, { licenseKey });

  const deleteCategory = useMutation(api.pos.menu.deleteCategory);
  const deleteItem = useMutation(api.pos.menu.deleteItem);
  const toggleAvailability = useMutation(api.pos.menu.toggleItemAvailability);

  const [selectedCategoryId, setSelectedCategoryId] =
    useState<Id<"menuCategories"> | null>(null);

  // Dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(
    null
  );
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Doc<"menuItems"> | null>(null);

  const isLoading = categories === undefined || allItems === undefined;

  // Auto-select first category if none is selected
  const activeCategoryId =
    selectedCategoryId ??
    (categories && categories.length > 0 ? categories[0]._id : null);

  const activeCategory = categories?.find((c) => c._id === activeCategoryId);

  const categoryItems = allItems
    ?.filter((item) => item.categoryId === activeCategoryId)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const handleDeleteCategory = async (catId: Id<"menuCategories">) => {
    const itemCount =
      allItems?.filter((i) => i.categoryId === catId).length ?? 0;
    const confirmed = window.confirm(
      itemCount > 0
        ? `Delete this category and its ${itemCount} item${itemCount > 1 ? "s" : ""}?`
        : "Delete this category?"
    );
    if (!confirmed) return;

    try {
      await deleteCategory({ licenseKey, categoryId: catId });
      if (activeCategoryId === catId) setSelectedCategoryId(null);
      toast.success("Category deleted");
    } catch {
      toast.error("Failed to delete category");
    }
  };

  const handleDeleteItem = async (itemId: Id<"menuItems">) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await deleteItem({ licenseKey, itemId });
      toast.success("Item deleted");
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleToggleAvailability = async (itemId: Id<"menuItems">) => {
    try {
      await toggleAvailability({ licenseKey, itemId });
    } catch {
      toast.error("Failed to update availability");
    }
  };

  // ── Loading ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-lg bg-[#131A2E]" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────
  if (categories.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <Header
          onAddCategory={() => {
            setEditingCategory(null);
            setCategoryDialogOpen(true);
          }}
        />
        <div className="mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossed />
              </EmptyMedia>
              <EmptyTitle>No menu categories yet</EmptyTitle>
              <EmptyDescription>
                Create your first category to start building your menu
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryDialogOpen(true);
                }}
              >
                <Plus className="size-4 mr-1" />
                Add Category
              </Button>
            </EmptyContent>
          </Empty>
        </div>

        <CategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          licenseKey={licenseKey}
          editing={editingCategory}
        />
      </div>
    );
  }

  // ── Main View ─────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Header
        onAddCategory={() => {
          setEditingCategory(null);
          setCategoryDialogOpen(true);
        }}
      />

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => setSelectedCategoryId(cat._id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer",
              activeCategoryId === cat._id
                ? "text-white shadow-lg"
                : "bg-[#131A2E] text-[#8b93a7] hover:text-white border border-[#1e2a45]"
            )}
            style={
              activeCategoryId === cat._id
                ? { backgroundColor: cat.color }
                : undefined
            }
          >
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                activeCategoryId === cat._id ? "bg-white/40" : ""
              )}
              style={
                activeCategoryId !== cat._id
                  ? { backgroundColor: cat.color }
                  : undefined
              }
            />
            {cat.name}
            {!cat.isActive && (
              <span className="text-[10px] opacity-60 ml-1">(hidden)</span>
            )}
          </button>
        ))}
      </div>

      {/* Active Category Header */}
      {activeCategory && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-1 h-8 rounded-full"
              style={{ backgroundColor: activeCategory.color }}
            />
            <div>
              <h2 className="text-lg font-semibold text-white">
                {activeCategory.name}
              </h2>
              <p className="text-xs text-[#5a6580]">
                {categoryItems?.length ?? 0} item
                {(categoryItems?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-[#1e2a45] text-[#8b93a7] hover:text-white border-0"
              onClick={() => {
                setEditingCategory({
                  _id: activeCategory._id,
                  name: activeCategory.name,
                  color: activeCategory.color,
                  isActive: activeCategory.isActive,
                });
                setCategoryDialogOpen(true);
              }}
            >
              <Pencil className="size-3.5 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-[#1e2a45] text-red-400 hover:text-red-300 hover:bg-red-500/10 border-0"
              onClick={() => handleDeleteCategory(activeCategory._id)}
            >
              <Trash2 className="size-3.5 mr-1" />
              Delete
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
            >
              <Plus className="size-4 mr-1" />
              Add Item
            </Button>
          </div>
        </div>
      )}

      {/* Items Grid */}
      {activeCategory && categoryItems && categoryItems.length === 0 && (
        <div className="py-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyTitle>No items in this category</EmptyTitle>
              <EmptyDescription>
                Add your first item to {activeCategory.name}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemDialogOpen(true);
                }}
              >
                <Plus className="size-4 mr-1" />
                Add Item
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      )}

      {categoryItems && categoryItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {categoryItems.map((item) => (
            <div
              key={item._id}
              className={cn(
                "rounded-xl border border-[#1e2a45] bg-[#131A2E] p-4 transition-all group hover:border-[#2a3a5a]",
                !item.available && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {item.name}
                    </h3>
                    {!item.available && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">
                        Unavailable
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-[#5a6580] mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <p
                    className="text-base font-bold mt-2"
                    style={{ color: activeCategory?.color ?? "#0066FF" }}
                  >
                    ${item.price.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={item.available}
                    onCheckedChange={() => handleToggleAvailability(item._id)}
                    className="scale-75"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1e2a45]">
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setItemDialogOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs text-[#5a6580] hover:text-white transition-colors cursor-pointer"
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
                <span className="text-[#1e2a45]">|</span>
                <button
                  onClick={() => handleDeleteItem(item._id)}
                  className="flex items-center gap-1 text-xs text-[#5a6580] hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        licenseKey={licenseKey}
        editing={editingCategory}
      />

      {activeCategoryId && (
        <ItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          licenseKey={licenseKey}
          categoryId={activeCategoryId}
          editing={editingItem}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function Header({ onAddCategory }: { onAddCategory: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UtensilsCrossed className="size-6" />
          Menu Management
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1 flex items-center gap-1">
          Categories
          <ChevronRight className="size-3" />
          Items
        </p>
      </div>
      <Button
        size="sm"
        onClick={onAddCategory}
      >
        <Plus className="size-4 mr-1" />
        New Category
      </Button>
    </div>
  );
}
