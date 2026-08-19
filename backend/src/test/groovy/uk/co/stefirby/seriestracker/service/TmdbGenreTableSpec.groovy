package uk.co.stefirby.seriestracker.service

import spock.lang.Specification

class TmdbGenreTableSpec extends Specification {

    TmdbGenreTable genreTable = new TmdbGenreTable()

    def "SERIES-007-AC-03/04: genre lookup table collapses Action/Adventure and Sci-Fi/Fantasy exactly as before"() {
        expect: "the forward lookup maps both aliases to the same TMDB id"
            genreTable.idFor("Action") == 10759
            genreTable.idFor("Adventure") == 10759
            genreTable.idFor("Sci-Fi") == 10765
            genreTable.idFor("Fantasy") == 10765

        and: "the reverse lookup renders TMDB's own canonical combined name"
            genreTable.displayNameFor(10759) == "Action & Adventure"
            genreTable.displayNameFor(10765) == "Sci-Fi & Fantasy"
    }

    def "SERIES-007-AC-04: every other stored genre name maps 1:1, unchanged from Spec 006"() {
        expect:
            genreTable.idFor(name) == id
            genreTable.displayNameFor(id) == displayName

        where:
            name         | id    | displayName
            "Animation"  | 16    | "Animation"
            "Comedy"     | 35    | "Comedy"
            "Crime"      | 80    | "Crime"
            "Documentary"| 99    | "Documentary"
            "Drama"      | 18    | "Drama"
            "Family"     | 10751 | "Family"
            "Kids"       | 10762 | "Kids"
            "Mystery"    | 9648  | "Mystery"
            "News"       | 10763 | "News"
            "Reality"    | 10764 | "Reality"
            "Soap"       | 10766 | "Soap"
            "Talk-Show"  | 10767 | "Talk"
            "War"        | 10768 | "War & Politics"
            "Western"    | 37    | "Western"
    }

    def "SERIES-007-AC-03/04: an unrecognized genre name/id resolves to null, not an error"() {
        expect: "genre names OMDb's broader vocabulary has that TMDB's fixed 16 TV genres don't cover are unmapped"
            genreTable.idFor("Thriller") == null
            genreTable.idFor("Horror") == null
            genreTable.displayNameFor(999999) == null
    }
}
