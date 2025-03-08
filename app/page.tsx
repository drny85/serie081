"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { Pencil, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Define the schema for player information
const playerSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters" })
    .refine((val) => val.trim().includes(" "), {
      message: "Please enter both first and last name",
    }),
  jerseyName: z
    .string()
    .min(1, { message: "Jersey name is required" })
    .max(15, { message: "Jersey name must be 15 characters or less" }),
  number: z
    .string()
    .regex(/^\d{1,2}$/, { message: "Number must be 1-2 digits" }),
  size: z.enum(["XS", "S", "M", "L", "XL", "XXL"], {
    message: "Please select a valid size",
  }),
  position: z.string().min(1, { message: "Position is required" }),
  notes: z.string().optional(),
});

// Type for our form data
type PlayerFormData = z.infer<typeof playerSchema>;

// Helper function to convert position to short name
const getPositionShortName = (position: string): string => {
  const positionMap: Record<string, string> = {
    Pitcher: "P",
    Catcher: "C",
    "First Base": "1B",
    "Second Base": "2B",
    "Third Base": "3B",
    Shortstop: "SS",
    "Left Field": "LF",
    "Center Field": "CF",
    "Right Field": "RF",
    "Designated Hitter": "DH",
    Utility: "UTIL",
    Fan: "FAN",
  };

  return positionMap[position] || position;
};

// Add these imports at the top
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

// Add these types after the PlayerFormData type
type SortConfig = {
  key: keyof PlayerFormData;
  direction: "asc" | "desc";
} | null;

// Add this sorting function before the Home component
const sortPlayers = (players: Doc<"players">[], sortConfig: SortConfig) => {
  if (!sortConfig) return players;

  return [...(players || [])].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === bValue) return 0;

    const direction = sortConfig.direction === "asc" ? 1 : -1;
    return aValue! > bValue! ? direction : -direction;
  });
};

export default function Home() {
  // State to store all players
  const add = useMutation(api.players.addPlayer);
  const players = useQuery(api.players.getPlayers);
  const deletePlayer = useMutation(api.players.deletePlayer);
  const updatePlayer = useMutation(api.players.updatePlayer);
  // State to track error for duplicate number
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  // State to control dialog open/close
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<PlayerFormData | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<Id<"players"> | null>(
    null
  );
  const [playerToEditId, setPlayerToDeleteId] = useState<Id<"players"> | null>(
    null
  );
  // Add sort config state
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: "",
      jerseyName: "",
      number: "",
      size: "M",
      position: "",
      notes: "",
    },
  });

  // Add the missing handleSort function
  const handleSort = (key: keyof PlayerFormData) => {
    setSortConfig((currentSort) => {
      if (currentSort?.key === key) {
        if (currentSort.direction === "asc") {
          return { key, direction: "desc" };
        }
        return null;
      }
      return { key, direction: "asc" };
    });
  };

  // Watch the name field to auto-fill jersey name
  const fullName = form.watch("name");

  // Auto-fill jersey name when full name changes
  useEffect(() => {
    if (fullName && fullName.includes(" ")) {
      const nameParts = fullName.trim().split(" ");
      const lastName = nameParts[nameParts.length - 1].toUpperCase();
      form.setValue("jerseyName", lastName);
    }
  }, [fullName, form]);

  // Function to handle edit player
  const handleEditPlayer = (player: Doc<"players">, index: Id<"players">) => {
    console.log("Editing player", player, index);
    setPlayerToEdit(player);
    setPlayerToDeleteId(index);
    form.reset(player);
    setIsDialogOpen(true);
  };

  // Function to handle delete player
  const handleDeletePlayer = (index: Id<"players">) => {
    console.log("Deleting player", index);
    setPlayerToDelete(index);
  };

  // Function to confirm delete
  const confirmDelete = (playerId: Id<"players">) => {
    console.log("Confirming delete", playerId);
    deletePlayer({ id: playerId });
  };

  // Handle form submission
  const onSubmit = async (data: PlayerFormData) => {
    // Check if we're editing an existing player
    if (playerToEdit && playerToEditId) {
      // Check if the jersey number is already taken by another player
      const isDuplicate = players?.some(
        (player) => player.number === data.number && player !== playerToEdit
      );

      if (isDuplicate) {
        setDuplicateError(
          `Jersey ${data.number} ya esta tomado.\n Preguntar si quiere intercambiar`
        );
        return;
      }
      console.log("Updating player", playerToEditId, data);
      updatePlayer({
        id: playerToEditId,
        playerSchema: { ...data },
      });
      setPlayerToEdit(null);
    } else {
      // Adding a new player
      const isDuplicate = players?.some(
        (player) => player.number === data.number
      );

      if (isDuplicate) {
        setDuplicateError(`Jersey number ${data.number} is already taken.`);
        return;
      }

      await add({
        name: data.name,
        jerseyName: data.jerseyName,
        number: data.number,
        size: data.size,
        position: data.position,
        notes: data.notes,
      });
      toast.success("Gracia por tu registracion!");
    }

    setDuplicateError(null);
    form.reset(); // Clear form after submission
    setIsDialogOpen(false); // Close the dialog
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      form.reset({
        name: "",
        jerseyName: "",
        number: "",
        size: "M",
        position: "",
        notes: "",
      });
      setPlayerToEdit(null);
      setDuplicateError(null);
    }
  }, [isDialogOpen, form]);

  return (
    <div className="flex flex-col min-h-screen p-2 pb-10 gap-8 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-2xl text-center font-bold">
        Serie 081 - Regsitro de Camisetas
      </h1>
      <p className="text-center text-xl">
        {players?.length} Jugadores registrado
      </p>
      <div className="md:hidden flex items-center gap-1 justify-center">
        <p className="text-center italic">
          Rotar el telefono horizontal para ver mas
        </p>

        <RotateCw />
      </div>
      <div className="w-full max-w-4xl mx-auto">
        {/* Table Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Jugadores Registrado</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>Inscribirme</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {playerToEdit ? "Editar" : "Informacion del Jugador"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Nombre & Apellido"
                              className="capitalize"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="jerseyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre En la camiseta</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="El nombre a mostrar en la parte de atras de la camiseta"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numero de Camiseta</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Escribe tu numero (1-99)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          {duplicateError && (
                            <p className="text-red-500 text-sm mt-1">
                              {duplicateError}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Size de la camiseta</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Elije un size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="XS">XS</SelectItem>
                              <SelectItem value="S">S</SelectItem>
                              <SelectItem value="M">M</SelectItem>
                              <SelectItem value="L">L</SelectItem>
                              <SelectItem value="XL">XL</SelectItem>
                              <SelectItem value="XXL">XXL</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posicion</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Elije una posicion" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Pitcher">Pitcher</SelectItem>
                              <SelectItem value="Catcher">Catcher</SelectItem>
                              <SelectItem value="First Base">
                                First Base
                              </SelectItem>
                              <SelectItem value="Second Base">
                                Second Base
                              </SelectItem>
                              <SelectItem value="Third Base">
                                Third Base
                              </SelectItem>
                              <SelectItem value="Shortstop">
                                Shortstop
                              </SelectItem>
                              <SelectItem value="Left Field">
                                Left Field
                              </SelectItem>
                              <SelectItem value="Center Field">
                                Center Field
                              </SelectItem>
                              <SelectItem value="Right Field">
                                Right Field
                              </SelectItem>
                              <SelectItem value="Designated Hitter">
                                Designated Hitter
                              </SelectItem>
                              <SelectItem value="Utility">Utility</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comentario</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Quieres decir algo?"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full">
                      {playerToEdit ? "Editar" : "Registrarme"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {players?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No players registered yet.</p>
              <Dialog onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Register Your First Player</Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleSort("name")}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:bg-gray-100 group"
                    >
                      <div className="flex items-center gap-1">
                        Name
                        <ArrowUpDown className="h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("jerseyName")}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                    >
                      <div className="flex items-center gap-1">
                        Jersey Name
                        <ArrowUpDown className="h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("number")}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                    >
                      <div className="flex items-center gap-1">
                        Number
                        <ArrowUpDown className="h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("size")}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                    >
                      <div className="flex items-center gap-1">
                        Size
                        <ArrowUpDown className="h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("position")}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                    >
                      <div className="flex items-center gap-1">
                        Position
                        <ArrowUpDown className="h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                      </div>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Notes
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortPlayers(players || [], sortConfig).map(
                    (player, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap capitalize hidden md:table-cell">
                          {player.name}
                        </td>

                        {/* Rest of the table row */}
                        <td className="px-4 py-2 whitespace-nowrap">
                          {player.jerseyName}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {player.number}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {player.size}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {getPositionShortName(player.position)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap hidden md:table-cell">
                          {player.notes || "-"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                handleEditPlayer(player, player._id)
                              }
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDeletePlayer(player._id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={playerToDelete !== null}
        onOpenChange={(open) => !open && setPlayerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              player from the registration list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (playerToDelete) {
                  confirmDelete(playerToDelete);
                  toast.success("Player deleted successfully");
                }
              }}
              className="bg-red-500 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Serie 081 Softball Team
      </footer>
    </div>
  );
}
