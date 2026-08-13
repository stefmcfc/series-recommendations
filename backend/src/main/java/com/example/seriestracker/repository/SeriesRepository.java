package com.example.seriestracker.repository;

import com.example.seriestracker.model.SeriesEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface SeriesRepository extends JpaRepository<SeriesEntity, UUID> {}
