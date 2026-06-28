"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Tenant } from "@/types/models/tenant";
import { Field, Input, Select } from "@/components/ui/Field";
import { merchantDirectoryService } from "@/services/api/stores-directory.service";
import { DirectoryArea } from "@/types/models/tenant";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type LocationData = {
  cityId: string;
  address: string;
};

export default function LocationStep({
  tenant,
  setTenant,
  onNext,
  locationData,
  setLocationData,
}: {
  tenant: Tenant;
  setTenant: (t: Tenant) => void;
  onNext: () => void;
  locationData: LocationData;
  setLocationData: (data: LocationData) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [areasLoading, setAreasLoading] = useState(true);
  const [allAreas, setAllAreas] = useState<DirectoryArea[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAreas = async () => {
      setAreasLoading(true);
      try {
        const response = await merchantDirectoryService.getActiveAreas();
        if (response.success && response.data) {
          setAllAreas(response.data);
        }
      } catch (error) {
        console.error("Failed to load areas", error);
      } finally {
        setAreasLoading(false);
      }
    };
    fetchAreas();
  }, []);

  const cities = useMemo(() => {
    return allAreas.filter((a) => a.parent_area_id === null).sort((a, b) => a.sort_order - b.sort_order);
  }, [allAreas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!locationData.cityId || !locationData.address) {
      setError("يرجى ملء جميع الحقول");
      return;
    }
    setLoading(true);
    try {
      await merchantDirectoryService.updateProfile({
        area_id: Number(locationData.cityId),
      });
      await onNext();
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حفظ البيانات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      <div className="space-y-4">
        {areasLoading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner className="w-8 h-8 text-brand-primary" />
          </div>
        ) : (
          <>
            <Field label="المدينة / المحافظة" htmlFor="city">
              <Select
                id="city"
                required
                value={locationData.cityId}
                onChange={(e) => {
                  setLocationData({ ...locationData, cityId: e.target.value });
                }}
              >
                <option value="" disabled>اختر المدينة / المحافظة</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name_ar}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="العنوان بالتفصيل" htmlFor="address">
              <Input 
                id="address"
                required 
                placeholder="اسم الشارع، رقم العمارة، علامة مميزة"
                value={locationData.address}
                onChange={(e) => setLocationData({ ...locationData, address: e.target.value })}
              />
            </Field>
          </>
        )}
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <Button type="submit" disabled={loading || areasLoading} size="lg" className="w-full sm:w-auto px-8">
          {loading ? "جاري الحفظ..." : "حفظ ومتابعة"}
        </Button>
      </div>
    </form>
  );
}
